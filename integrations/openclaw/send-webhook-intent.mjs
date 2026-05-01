#!/usr/bin/env node
/**
 * Send an external webhook intent into GuardMesh.
 *
 * Usage:
 *   node integrations/openclaw/send-webhook-intent.mjs intent.json
 *   node integrations/openclaw/send-webhook-intent.mjs --stdin < intent.json
 *
 * Env:
 *   GUARDMESH_WEBHOOK_URL   default: http://127.0.0.1:3000/api/guardmesh/webhook
 *   GUARDMESH_WEBHOOK_TOKEN optional bearer token
 */

import fs from "node:fs/promises";

const WEBHOOK_URL =
  process.env.GUARDMESH_WEBHOOK_URL?.trim() ||
  "http://127.0.0.1:3000/api/guardmesh/webhook";
const WEBHOOK_TOKEN = process.env.GUARDMESH_WEBHOOK_TOKEN?.trim() || "";

function usage() {
  console.error(
    "Usage: node integrations/openclaw/send-webhook-intent.mjs <intent.json>\n" +
      "   or: node integrations/openclaw/send-webhook-intent.mjs --stdin < intent.json"
  );
}

async function readBody() {
  const arg = process.argv[2];
  if (!arg) {
    usage();
    process.exit(2);
  }

  if (arg === "--stdin") {
    let txt = "";
    for await (const chunk of process.stdin) txt += chunk;
    return txt;
  }
  return await fs.readFile(arg, "utf8");
}

async function main() {
  const raw = await readBody();
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error(
      JSON.stringify(
        { ok: false, error: `Invalid JSON payload: ${e instanceof Error ? e.message : String(e)}` },
        null,
        2
      )
    );
    process.exit(2);
  }

  const headers = { "Content-Type": "application/json" };
  if (WEBHOOK_TOKEN) headers.Authorization = `Bearer ${WEBHOOK_TOKEN}`;

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(json),
    signal: AbortSignal.timeout(120000)
  });
  const text = await res.text();
  let out;
  try {
    out = JSON.parse(text);
  } catch {
    out = { raw: text };
  }
  console.log(JSON.stringify({ status: res.status, ok: res.ok, result: out }, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
  process.exit(1);
});
