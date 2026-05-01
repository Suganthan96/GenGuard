import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:3000/api/guardmesh/intent";
const DEFAULT_INTENT_TIMEOUT_MS = 20000;
const DEFAULT_APPROVAL_TTL_MS = 120000;
const DEFAULT_VERIFY_INTERVAL_MS = 300000;

const SESSION_APPROVALS = new Map();
let verifyTimer = null;

function now() {
  return Date.now();
}

function toInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function getConfig(event) {
  const cfg = (event && event.context && event.context.pluginConfig) || {};
  return {
    bridgeUrl: String(cfg.bridgeUrl || process.env.GUARDMESH_BRIDGE_URL || DEFAULT_BRIDGE_URL).trim(),
    timeoutMs: Math.max(3000, toInt(cfg.intentTimeoutMs || process.env.GUARDMESH_PLUGIN_INTENT_TIMEOUT_MS, DEFAULT_INTENT_TIMEOUT_MS)),
    approvalTtlMs: Math.max(10000, toInt(cfg.approvalTtlMs || process.env.GUARDMESH_PLUGIN_APPROVAL_TTL_MS, DEFAULT_APPROVAL_TTL_MS)),
    enforceTools: Array.isArray(cfg.enforceTools)
      ? cfg.enforceTools.map(String)
      : ["exec", "apply_patch", "web_fetch", "shell_command"],
    verifyUrl: String(cfg.verifyUrl || process.env.GUARDMESH_VERIFY_URL || "http://127.0.0.1:3000/api/guardmesh/analysis/config").trim(),
    verifyIntervalMs: Math.max(
      30000,
      toInt(cfg.verifyIntervalMs || process.env.GUARDMESH_VERIFY_INTERVAL_MS, DEFAULT_VERIFY_INTERVAL_MS)
    ),
    webhookPath: String(cfg.webhookPath || "/plugins/guardmesh/webhook").trim(),
    webhookToken: String(cfg.webhookToken || process.env.GUARDMESH_WEBHOOK_TOKEN || "").trim()
  };
}

function isApprovalFresh(sessionKey, ttlMs) {
  const approvedAt = SESSION_APPROVALS.get(sessionKey);
  if (!approvedAt) return false;
  return now() - approvedAt < ttlMs;
}

function markApproved(sessionKey) {
  if (!sessionKey) return;
  SESSION_APPROVALS.set(sessionKey, now());
}

async function evaluateIntent(config, intent) {
  const res = await fetch(config.bridgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
    signal: AbortSignal.timeout(config.timeoutMs)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`GuardMesh intent HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function buildIntentFromToolCall(event) {
  const toolName = String(event.toolName || "").trim();
  const params = event.params && typeof event.params === "object" ? event.params : {};
  const actionType = inferActionType(toolName, params);
  const target = inferTarget(toolName, params, actionType);
  const paramsSnippet = JSON.stringify(params).slice(0, 2000);
  return {
    agent_id: String(process.env.GUARDMESH_DEFAULT_AGENT_ID || "").trim(),
    action_type: actionType,
    target,
    content: `Tool call preflight for ${toolName}. Params: ${paramsSnippet}`,
    data_touched: [toolName],
    role_scope: String(process.env.GUARDMESH_DEFAULT_ROLE_SCOPE || "").trim()
  };
}

function inferActionType(toolName, params) {
  const t = String(toolName || "").toLowerCase();
  if (t.includes("query-db") || t.includes("query_db")) return "query_db";
  if (t.includes("read-file") || t.includes("read_file")) return "read_file";
  if (t.includes("code-analysis") || t.includes("code_analysis")) return "code_analysis";
  if (t.includes("exec") || t.includes("shell")) {
    const cmd = String(params.command || "").toLowerCase();
    if (cmd.includes("mongo") || cmd.includes("mongodb")) return "query_db";
    if (cmd.includes("cat ") || cmd.includes("type ") || cmd.includes("ls ") || cmd.includes("dir ")) {
      return "read_file";
    }
  }
  return "code_analysis";
}

function inferTarget(toolName, params, actionType) {
  if (actionType === "read_file") {
    const p = String(params.path || params.file || params.target || "").trim();
    return p || toolName || "workspace";
  }
  if (actionType === "query_db") {
    const coll = String(params.collection || "").trim();
    if (coll) return `mongodb:${coll}`;
    return "mongodb";
  }
  const target = String(params.target || "").trim();
  return target || toolName || "workspace";
}

function extractExecute(consensus) {
  return Boolean(consensus && consensus.execute === true);
}

export default definePluginEntry({
  id: "guardmesh-runtime",
  name: "GuardMesh Runtime",
  description: "GuardMesh policy enforcement hook, webhook intake, and background verifier for OpenClaw.",
  register(api) {
    api.on(
      "before_tool_call",
      async (event) => {
        const config = getConfig(event);
        const toolName = String(event.toolName || "");
        if (!config.enforceTools.includes(toolName)) return;

        const sessionKey =
          String(event.context?.sessionKey || event.context?.sessionId || event.context?.runId || "global");
        if (isApprovalFresh(sessionKey, config.approvalTtlMs)) return;

        const intent = buildIntentFromToolCall(event);
        if (!intent.agent_id) {
          return {
            requireApproval: {
              title: "GuardMesh preflight not configured",
              description:
                "Set GUARDMESH_DEFAULT_AGENT_ID so GuardMesh can evaluate this tool call policy before execution.",
              severity: "warning",
              timeoutBehavior: "deny",
              timeoutMs: 60000
            }
          };
        }

        const result = await evaluateIntent(config, intent);
        if (!extractExecute(result.consensus)) {
          const reason =
            result?.consensus?.finalDecision?.agentInstruction ||
            result?.consensus?.rationale ||
            "GuardMesh did not approve this tool call.";
          return { block: true, blockReason: reason };
        }

        markApproved(sessionKey);
        return;
      },
      { priority: 80, timeoutMs: 45000 }
    );

    if (typeof api.registerHttpRoute === "function") {
      api.registerHttpRoute({
        method: "POST",
        path: getConfig({ context: { pluginConfig: {} } }).webhookPath,
        async handler(req) {
          const config = getConfig({ context: { pluginConfig: req?.pluginConfig || {} } });
          if (config.webhookToken) {
            const auth = String(req.headers?.authorization || "");
            if (auth !== `Bearer ${config.webhookToken}`) {
              return { status: 401, body: { ok: false, error: "Unauthorized webhook token" } };
            }
          }

          const body = req.body || {};
          const intent = body.intent || body;
          if (!intent || typeof intent !== "object") {
            return { status: 400, body: { ok: false, error: "Webhook must include intent object" } };
          }
          try {
            const result = await evaluateIntent(config, intent);
            return { status: 200, body: { ok: true, result } };
          } catch (error) {
            return {
              status: 502,
              body: { ok: false, error: error instanceof Error ? error.message : String(error) }
            };
          }
        }
      });
    }

    api.on("gateway_start", async (event) => {
      const config = getConfig(event);
      if (verifyTimer) clearInterval(verifyTimer);
      verifyTimer = setInterval(async () => {
        try {
          await fetch(config.verifyUrl, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
            cache: "no-store"
          });
        } catch {
          // Keep this low-risk heartbeat quiet; hook should not crash the gateway.
        }
      }, config.verifyIntervalMs);
    });

    api.on("gateway_stop", async () => {
      if (verifyTimer) {
        clearInterval(verifyTimer);
        verifyTimer = null;
      }
      SESSION_APPROVALS.clear();
    });
  }
});
