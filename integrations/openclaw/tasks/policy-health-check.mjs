#!/usr/bin/env node
/**
 * Background verifier for GuardMesh policy + mesh API health.
 * Intended for OpenClaw scheduled tasks or regular cron.
 */

const BASE = (process.env.GUARDMESH_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const AGENT_ID = (process.env.GUARDMESH_HEALTH_AGENT_ID || "").trim();
const TIMEOUT_MS = Math.max(2000, Number(process.env.GUARDMESH_HEALTH_TIMEOUT_MS || 12000));

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    baseUrl: BASE,
    checks: []
  };

  const config = await fetchJson(`${BASE}/api/guardmesh/analysis/config`);
  report.checks.push({
    name: "analysis_config",
    ok: config.res.ok,
    status: config.res.status,
    detail: config.json
  });

  if (AGENT_ID) {
    const policy = await fetchJson(`${BASE}/api/guardmesh/policy/${encodeURIComponent(AGENT_ID)}`);
    report.checks.push({
      name: "policy_lookup",
      ok: policy.res.ok,
      status: policy.res.status,
      detail: policy.json
    });
  } else {
    report.checks.push({
      name: "policy_lookup",
      ok: false,
      status: 0,
      detail: "Set GUARDMESH_HEALTH_AGENT_ID to verify on-chain policy fetch."
    });
  }

  const allOk = report.checks.every((c) => c.ok);
  console.log(JSON.stringify({ ok: allOk, report }, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});

