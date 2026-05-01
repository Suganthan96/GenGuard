/**
 * Read GuardMesh policy JSON from 0G KV (KV node RPC — same role as `0g-storage-client kv-read`).
 * When `GUARDMESH_KV_NODE_URL` is set on guardians, `registry-policy-gate` **requires** a KV row
 * (no chain fallback for policy fields). Returns null only if the node URL is unset or read/parse fails.
 */

import { KvClient } from "@0gfoundation/0g-ts-sdk";
import { normalizeGuardmeshKvStreamId } from "./kv-stream-id-normalize.mjs";

/**
 * @param {string} agentId
 * @returns {Promise<object | null>}
 */
export async function getPolicyFromKv(agentId) {
  const nodeUrl = (process.env.GUARDMESH_KV_NODE_URL || "").trim();
  if (!nodeUrl) {
    return null;
  }
  const streamId = normalizeGuardmeshKvStreamId(process.env.GUARDMESH_KV_STREAM_ID);
  const id = String(agentId || "").trim();
  if (!id) return null;

  try {
    const client = new KvClient(nodeUrl);
    const key = new TextEncoder().encode(id);
    const val = await client.getValue(streamId, key);
    if (!val?.data) return null;
    const json = Buffer.from(val.data, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.allowedActions)) return null;
    return parsed;
  } catch (e) {
    console.warn(`[kv-policy] read failed for "${id}":`, e?.message || e);
    return null;
  }
}
