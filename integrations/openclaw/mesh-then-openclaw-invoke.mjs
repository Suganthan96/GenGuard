#!/usr/bin/env node
/**
 * GuardMesh consensus → OpenClaw Gateway POST /tools/invoke (official HTTP tool path).
 *
 * OpenClaw docs:
 * - Gateway runbook: https://docs.openclaw.ai/gateway/index.md
 * - Tools invoke API: https://docs.openclaw.ai/gateway/tools-invoke-http-api.md
 * - Tools / policy: https://docs.openclaw.ai/gateway/config-tools.md
 *
 * Plan JSON shape:
 *   { "intent": { ... }, "consensus_threshold"?: "phase5"|"unanimous"|"majority"|"any",
 *     "invoke": { "tool", "args"?, "sessionKey"?, "action"? } }
 * Omit "invoke" to only run mesh and print the intent API response (same as guardmesh-bridge).
 *
 * Env:
 *   GUARDMESH_BRIDGE_URL — default http://127.0.0.1:3000/api/guardmesh/intent
 *   OPENCLAW_GATEWAY_URL — default http://127.0.0.1:18789
 *   OPENCLAW_GATEWAY_TOKEN — Bearer secret (gateway.auth.token); required when "invoke" is present
 *
 * Flags:
 *   --require-uncontested — do not call /tools/invoke if consensus.contested is true (even when execute is true)
 *
 * Exit: 0 ok | 1 HTTP/parse error (intent) | 2 mesh denied / human review / contested+flag | 3 invoke HTTP error | 4 missing token with invoke
 */

import fs from "node:fs"
import path from "node:path"

const BRIDGE_URL = process.env.GUARDMESH_BRIDGE_URL?.trim() || "http://127.0.0.1:3000/api/guardmesh/intent"
const GATEWAY_URL = (process.env.OPENCLAW_GATEWAY_URL?.trim() || "http://127.0.0.1:18789").replace(/\/$/, "")
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || ""
const requireUncontested = process.argv.includes("--require-uncontested")

function usage() {
  console.error(
    "Usage: node mesh-then-openclaw-invoke.mjs <plan.json> [--require-uncontested]\n" +
      `  GUARDMESH_BRIDGE_URL (default ${BRIDGE_URL})\n` +
      `  OPENCLAW_GATEWAY_URL (default ${GATEWAY_URL})\n` +
      "  OPENCLAW_GATEWAY_TOKEN (required if plan includes \"invoke\")\n"
  )
  process.exit(1)
}

async function postIntent(body, timeoutMs) {
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { res, json }
}

async function postToolsInvoke(payload) {
  const url = `${GATEWAY_URL}/tools/invoke`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { res, json }
}

async function main() {
  const file = process.argv.find((a) => !a.startsWith("-") && a.endsWith(".json"))
  if (!file) usage()

  const raw = fs.readFileSync(path.resolve(process.cwd(), file), "utf8")
  let plan
  try {
    plan = JSON.parse(raw)
  } catch {
    console.error("Invalid JSON in plan file")
    process.exit(1)
  }

  const intent = plan.intent
  if (!intent?.agent_id) {
    console.error('Plan must include "intent" with agent_id')
    process.exit(1)
  }

  const timeoutMs = Math.min(Math.max(Number(process.env.GUARDMESH_BRIDGE_TIMEOUT_MS) || 30000, 5000), 120000)
  const intentBody = { intent }
  if (typeof plan.consensus_threshold === "string" && plan.consensus_threshold.trim()) {
    intentBody.consensus_threshold = plan.consensus_threshold.trim()
  }
  const { res, json } = await postIntent(intentBody, timeoutMs)

  console.log(JSON.stringify(json, null, 2))
  const fd = json.consensus?.finalDecision
  if (fd?.action && fd?.agentInstruction) {
    console.error(`[mesh-then-openclaw-invoke] finalDecision=${fd.action}`)
    console.error(`[mesh-then-openclaw-invoke] ${fd.agentInstruction}`)
  }

  if (!res.ok) {
    process.exit(1)
  }

  const consensus = json.consensus
  const invoke = plan.invoke

  if (!invoke || typeof invoke.tool !== "string" || !invoke.tool.trim()) {
    process.exit(0)
  }

  if (!TOKEN) {
    console.error("mesh-then-openclaw-invoke: OPENCLAW_GATEWAY_TOKEN is required when plan includes invoke.")
    process.exit(4)
  }

  if (!consensus || typeof consensus !== "object") {
    console.error("mesh-then-openclaw-invoke: intent response missing consensus object.")
    process.exit(2)
  }

  if (!consensus.execute) {
    console.error("mesh-then-openclaw-invoke: mesh consensus.execute is false — not invoking OpenClaw tool.")
    process.exit(2)
  }

  if (requireUncontested && consensus.contested) {
    console.error("mesh-then-openclaw-invoke: --require-uncontested and consensus.contested — skipping invoke.")
    process.exit(2)
  }

  const invokeBody = {
    tool: invoke.tool.trim(),
    sessionKey: invoke.sessionKey ?? "main",
    dryRun: false,
    args: invoke.args && typeof invoke.args === "object" ? invoke.args : {},
  }
  if (invoke.action != null) {
    invokeBody.action = invoke.action
  }

  const inv = await postToolsInvoke(invokeBody)
  console.log(JSON.stringify(inv.json, null, 2))

  if (!inv.res.ok) {
    process.exit(3)
  }
  const ok = inv.json?.ok === true
  if (!ok) {
    process.exit(3)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
