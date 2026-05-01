#!/usr/bin/env node
/**
 * Verify one or more 0G Storage decision bundles by merkle root.
 *
 * Env:
 *   GUARDMESH_WEB_BASE_URL      default http://127.0.0.1:3000
 *   GUARDMESH_VERIFY_ROOTS      required comma-separated merkle roots
 *   GUARDMESH_VERIFY_TIMEOUT_MS default 20000
 */

const BASE = (process.env.GUARDMESH_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const ROOTS = String(process.env.GUARDMESH_VERIFY_ROOTS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const TIMEOUT_MS = Math.max(3000, Number(process.env.GUARDMESH_VERIFY_TIMEOUT_MS || 20000));

async function fetchBundle(root) {
  const url = `${BASE}/api/guardmesh/retrieve-bundle?merkleRoot=${encodeURIComponent(root)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
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
  if (ROOTS.length === 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "Set GUARDMESH_VERIFY_ROOTS to comma-separated merkle roots."
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const checks = [];
  for (const root of ROOTS) {
    const r = await fetchBundle(root);
    checks.push({
      merkleRoot: root,
      ok: r.ok && Boolean(r.json?.ok) && Boolean(r.json?.verified),
      status: r.status,
      verified: Boolean(r.json?.verified),
      message: r.json?.message || "",
      verificationNotes: Array.isArray(r.json?.verificationNotes) ? r.json.verificationNotes : []
    });
  }

  const ok = checks.every((c) => c.ok);
  console.log(JSON.stringify({ ok, baseUrl: BASE, count: checks.length, checks }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
  process.exit(1);
});
