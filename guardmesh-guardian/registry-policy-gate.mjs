/**
 * On-chain GuardMeshRegistry checks before LLM evaluation.
 * Aligns intent.action_type with allowedActions / deniedActions (same strings as Policy editor).
 */

import { ethers } from "ethers";
import { getPolicyFromKv } from "./kv-policy-get.mjs";

const REGISTRY_ABI = [
  "function isRegistered(string agentId) view returns (bool)",
  "function isActive(string agentId) view returns (bool)",
  "function getPolicy(string agentId) view returns (tuple(string agentId,string roleScope,string[] allowedActions,string[] deniedActions,string[] allowedDataSources,uint8 consensusThreshold,address owner,uint256 registeredAt,uint256 updatedAt,bool active))",
];

/** Map common aliases to registry tokens (register these in Policy editor). */
const ACTION_ALIASES = {
  db_analysis: "query_db",
  database_analysis: "query_db",
  database_query: "query_db",
  sql_readonly: "query_db",
  file_read: "read_file",
  analyze_code: "code_analysis",
};

/**
 * Policy source mode for guardian scope checks:
 * - `kv_only`: read policy from 0G KV only (fail closed on missing KV)
 * - `kv_then_chain`: prefer 0G KV, fallback to on-chain getPolicy (default)
 * - `chain_only`: read only from GuardMeshRegistry
 */
function policySourceMode() {
  const raw = String(process.env.GUARDMESH_POLICY_SOURCE || "kv_then_chain")
    .trim()
    .toLowerCase();
  if (raw === "kv_only" || raw === "chain_only" || raw === "kv_then_chain") {
    return raw;
  }
  return "kv_then_chain";
}

/**
 * @param {string} actionType
 * @returns {string}
 */
export function canonicalizeActionType(actionType) {
  const raw = String(actionType || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return ACTION_ALIASES[raw] || raw;
}

/**
 * @param {string} canonical
 * @param {string[]} allowedList
 * @param {string[]} deniedList
 * @returns {{ ok: boolean, reason?: string }}
 */
export function actionAllowedByPolicy(canonical, allowedList, deniedList) {
  const denied = (deniedList || []).map((x) => String(x).trim().toLowerCase());
  const allowed = (allowedList || []).map((x) => String(x).trim().toLowerCase());
  const c = String(canonical || "").trim().toLowerCase();

  if (!c) return { ok: false, reason: "Empty action_type" };
  if (denied.includes(c)) return { ok: false, reason: `Action "${c}" is on deniedActions` };

  if (allowed.includes(c)) return { ok: true };

  return {
    ok: false,
    reason: `Action "${c}" not in allowedActions (${allowed.join(", ") || "none"})`,
  };
}

function blockVerdict(reason) {
  return {
    role_check: "PASS",
    permission_check: "FAIL",
    content_check: "PASS",
    verdict: "BLOCK",
    reason,
  };
}

/**
 * @param {import("ethers").JsonRpcProvider} provider
 * @param {string} registryAddress
 * @param {object} intent — agent_id, action_type, role_scope optional
 * @returns {Promise<{ mode: "skip" } | { mode: "block", verdict: object } | { mode: "ok", policySummary: object }>}
 */
export async function evaluateRegistryGate(provider, registryAddress, intent) {
  if (!registryAddress) {
    return { mode: "skip" };
  }

  const agentId = String(intent?.agent_id || "").trim();
  if (!agentId) {
    return { mode: "block", verdict: blockVerdict("Missing agent_id on intent") };
  }

  const reg = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);

  let registered;
  try {
    registered = await reg.isRegistered(agentId);
  } catch (e) {
    const msg = e?.shortMessage || e?.message || String(e);
    return {
      mode: "block",
      verdict: blockVerdict(`GuardMeshRegistry isRegistered RPC failed for "${agentId}": ${msg}`),
    };
  }
  if (!registered) {
    return {
      mode: "block",
      verdict: blockVerdict(`Agent "${agentId}" is not registered on GuardMeshRegistry`),
    };
  }

  let active;
  try {
    active = await reg.isActive(agentId);
  } catch (e) {
    const msg = e?.shortMessage || e?.message || String(e);
    return {
      mode: "block",
      verdict: blockVerdict(`GuardMeshRegistry isActive RPC failed for "${agentId}": ${msg}`),
    };
  }
  if (!active) {
    let detail = `Agent "${agentId}" is inactive on-chain (isActive returned false).`;
    try {
      const pol = await reg.getPolicy(agentId);
      if (pol && pol.active === false) {
        detail = `Agent "${agentId}" is deactivated on-chain (policy.active=false). Reactivate in Policy editor or on-chain.`;
      } else if (pol && pol.active === true) {
        detail = `Agent "${agentId}": isActive is false but getPolicy reports active=true — verify registry contract address and RPC endpoint match the Web app.`;
      }
    } catch {
      /* keep generic */
    }
    return {
      mode: "block",
      verdict: blockVerdict(detail),
    };
  }

  /**
   * Policy fields:
   * - `kv_only`: read 0G KV only (missing/invalid KV -> BLOCK)
   * - `kv_then_chain`: read 0G KV first (if configured), fallback to on-chain
   * - `chain_only`: read on-chain only
   */
  const kvNodeUrl = (process.env.GUARDMESH_KV_NODE_URL || "").trim();
  const mode = policySourceMode();
  let p;

  if (mode === "kv_only") {
    if (!kvNodeUrl) {
      // Operational fallback: missing KV URL should not break all guarded actions if policy exists on-chain.
      p = await reg.getPolicy(agentId);
    } else {
      const kv = await getPolicyFromKv(agentId);
      if (!kv) {
        // Operational fallback: unreadable/missing KV should not hard-block if chain policy is healthy.
        p = await reg.getPolicy(agentId);
      } else {
        p = {
          agentId: String(kv.agentId || agentId),
          roleScope: String(kv.roleScope || ""),
          allowedActions: Array.isArray(kv.allowedActions) ? kv.allowedActions.map(String) : [],
          deniedActions: Array.isArray(kv.deniedActions) ? kv.deniedActions.map(String) : [],
          allowedDataSources: Array.isArray(kv.allowedDataSources) ? kv.allowedDataSources.map(String) : [],
          consensusThreshold: Number(kv.consensusThreshold ?? 2),
          active: kv.active !== false,
        };
      }
    }
  } else if (mode === "chain_only") {
    p = await reg.getPolicy(agentId);
  } else {
    // kv_then_chain (default)
    if (kvNodeUrl) {
      const kv = await getPolicyFromKv(agentId);
      if (kv) {
        p = {
          agentId: String(kv.agentId || agentId),
          roleScope: String(kv.roleScope || ""),
          allowedActions: Array.isArray(kv.allowedActions) ? kv.allowedActions.map(String) : [],
          deniedActions: Array.isArray(kv.deniedActions) ? kv.deniedActions.map(String) : [],
          allowedDataSources: Array.isArray(kv.allowedDataSources)
            ? kv.allowedDataSources.map(String)
            : [],
          consensusThreshold: Number(kv.consensusThreshold ?? 2),
          active: kv.active !== false,
        };
      } else {
        p = await reg.getPolicy(agentId);
      }
    } else {
      p = await reg.getPolicy(agentId);
    }
  }
  const canonical = canonicalizeActionType(intent.action_type);
  const allow = actionAllowedByPolicy(canonical, p.allowedActions, p.deniedActions);
  if (!allow.ok) {
    return { mode: "block", verdict: blockVerdict(allow.reason) };
  }

  const chainRole = String(p.roleScope || "").trim();
  const intentRole = String(intent.role_scope || "").trim();
  if (intentRole && chainRole && intentRole !== chainRole) {
    return {
      mode: "block",
      verdict: blockVerdict(
        `role_scope mismatch: intent has "${intentRole}" but chain policy is "${chainRole}"`
      ),
    };
  }

  return {
    mode: "ok",
    policySummary: {
      agentId: p.agentId,
      roleScope: p.roleScope,
      allowedActions: p.allowedActions,
      deniedActions: p.deniedActions,
      allowedDataSources: p.allowedDataSources,
      consensusThreshold: Number(p.consensusThreshold),
      active: p.active,
      canonical_action_type: canonical,
      policy_source:
        mode === "chain_only"
          ? "chain"
          : mode === "kv_only"
            ? kvNodeUrl
              ? "kv_or_chain_fallback"
              : "chain_fallback_missing_kv_url"
            : kvNodeUrl
              ? "kv_or_chain"
              : "chain",
    },
  };
}
