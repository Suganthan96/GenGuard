#!/usr/bin/env node
/**
 * Sync a list of agent policies from chain -> 0G KV by calling Web /api/guardmesh/kv-sync.
 *
 * Env:
 *   GUARDMESH_WEB_BASE_URL      default http://127.0.0.1:3000
 *   GUARDMESH_TOOL_SECRET       optional bearer auth for protected routes
 *   GUARDMESH_SYNC_AGENT_IDS    required comma-separated ids (e.g. a.eth,b.eth)
 *   GUARDMESH_SYNC_TIMEOUT_MS   default 15000
 */

const BASE = (process.env.GUARDMESH_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const TOOL_SECRET = (process.env.GUARDMESH_TOOL_SECRET || "").trim();
const AGENT_IDS = String(process.env.GUARDMESH_SYNC_AGENT_IDS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const TIMEOUT_MS = Math.max(2000, Number(process.env.GUARDMESH_SYNC_TIMEOUT_MS || 15000));

async function postJson(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (TOOL_SECRET) headers.Authorization = `Bearer ${TOOL_SECRET}`;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  if (AGENT_IDS.length === 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "Set GUARDMESH_SYNC_AGENT_IDS to a comma-separated list (e.g. newwww.eth,eng-assistant-04)."
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const results = [];
  for (const agentId of AGENT_IDS) {
    const r = await postJson("/api/guardmesh/kv-sync", { agent_id: agentId });
    results.push({ agentId, ...r });
  }

  const ok = results.every((r) => r.ok);
  console.log(JSON.stringify({ ok, baseUrl: BASE, count: results.length, results }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
  process.exit(1);
});
