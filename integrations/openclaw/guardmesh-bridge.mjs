#!/usr/bin/env node
/**
 * GuardMesh ↔ OpenClaw bridge: POST an intent to the GenGuard Next API (or any compatible URL).
 *
 * Usage (from integrations/openclaw):
 *   node guardmesh-bridge.mjs examples/intent.example.json
 *   node guardmesh-bridge.mjs examples/intent-with-threshold.example.json
 *   node guardmesh-bridge.mjs --stdin   < my-intent.json
 * Env:
 *   GUARDMESH_BRIDGE_URL — default http://127.0.0.1:3000/api/guardmesh/intent
 *
 * Optional flags:
 *   --strict — exit 1 unless some guardian verdict is APPROVE (verdicts[])
 *   --strict-consensus — exit 1 unless response.consensus.execute === true
 *   --strict-final — exit 1 unless finalDecision.action is execute or execute_contested
 *
 * Exit codes:
 *   0 — HTTP 200 (and strict flags satisfied when set)
 *   1 — HTTP error, bad JSON, missing intent, or strict / strict-consensus failed
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BRIDGE_URL = process.env.GUARDMESH_BRIDGE_URL?.trim() || "http://127.0.0.1:3000/api/guardmesh/intent"
const strict = process.argv.includes("--strict")
const strictConsensus = process.argv.includes("--strict-consensus")
const strictFinal = process.argv.includes("--strict-final")

async function readPayload() {
  const stdin = process.argv.includes("--stdin")
  if (stdin) {
    const chunks = []
    for await (const c of process.stdin) chunks.push(c)
    return Buffer.concat(chunks).toString("utf8")
  }
  const file = process.argv.find((a) => !a.startsWith("-") && a.endsWith(".json"))
  if (!file) {
    console.error(
      "Usage: cd integrations/openclaw && node guardmesh-bridge.mjs <path-to-intent.json>\n" +
        "  Example: node guardmesh-bridge.mjs examples/intent.example.json\n" +
        "  Or:      node guardmesh-bridge.mjs --stdin < intent.json\n" +
        "Optional: --strict | --strict-consensus | --strict-final\n" +
        `Env: GUARDMESH_BRIDGE_URL (default ${BRIDGE_URL})`
    )
    process.exit(1)
  }
  const abs = path.resolve(process.cwd(), file)
  try {
    return fs.readFileSync(abs, "utf8")
  } catch (e) {
    if (e && e.code === "ENOENT") {
      console.error(`ENOENT: no such file: ${abs}`)
      console.error(
        "Tip: use a real path. From integrations/openclaw try:\n" +
          "  node guardmesh-bridge.mjs examples/intent.example.json\n" +
          "Or copy examples/intent.example.json and edit agent_id / role_scope to match your on-chain policy."
      )
    }
    throw e
  }
}

function normalizeBody(raw) {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") return { intent: {} }
  if (parsed.intent) return parsed
  const { consensus_threshold, ...rest } = parsed
  const out = { intent: rest }
  if (consensus_threshold != null && String(consensus_threshold).trim()) {
    out.consensus_threshold = String(consensus_threshold).trim()
  }
  return out
}

function verdictText(row) {
  const v = row?.verdict
  if (typeof v === "string") return v.trim().toUpperCase()
  if (v && typeof v === "object" && typeof v.verdict === "string") return v.verdict.trim().toUpperCase()
  return ""
}

function hasApprove(verdicts) {
  if (!Array.isArray(verdicts)) return false
  return verdicts.some((row) => verdictText(row) === "APPROVE")
}

async function main() {
  let raw
  try {
    raw = await readPayload()
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  let body
  try {
    body = normalizeBody(raw)
  } catch {
    console.error("Invalid JSON")
    process.exit(1)
  }

  const defAgent = process.env.GUARDMESH_DEFAULT_AGENT_ID?.trim()
  const defRole = process.env.GUARDMESH_DEFAULT_ROLE_SCOPE?.trim()
  if (!body.intent || typeof body.intent !== "object") {
    console.error("Body must include intent (wrap as { intent: { ... } } or pass intent fields as root).")
    process.exit(1)
  }
  if (defAgent && !String(body.intent.agent_id || "").trim()) {
    body.intent.agent_id = defAgent
  }
  if (defRole && !String(body.intent.role_scope || "").trim()) {
    body.intent.role_scope = defRole
  }
  if (!String(body.intent.agent_id || "").trim()) {
    console.error(
      "intent.agent_id is required (or set GUARDMESH_DEFAULT_AGENT_ID in the shell running this bridge)."
    )
    process.exit(1)
  }

  /** Must exceed Web `GUARDMESH_INTENT_TIMEOUT_MS` + Phase 6 upload/anchor when enabled (default cap 5 min). */
  const timeoutMs = Math.min(Math.max(Number(process.env.GUARDMESH_BRIDGE_TIMEOUT_MS) || 30000, 5000), 300000)
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

  console.log(JSON.stringify(json, null, 2))

  const fd = json.consensus?.finalDecision
  if (fd?.action && fd?.agentInstruction) {
    console.error(`[guardmesh-bridge] finalDecision=${fd.action}`)
    console.error(`[guardmesh-bridge] ${fd.agentInstruction}`)
  }

  if (!res.ok) {
    process.exit(1)
  }

  if (strict && !hasApprove(json.verdicts)) {
    console.error("guardmesh-bridge: --strict set but no APPROVE verdict in response.")
    process.exit(1)
  }

  if (strictConsensus) {
    const ex = json.consensus?.execute === true
    if (!ex) {
      console.error(
        "guardmesh-bridge: --strict-consensus set but consensus.execute is not true (see printed JSON)."
      )
      process.exit(1)
    }
  }

  if (strictFinal) {
    const a = json.consensus?.finalDecision?.action
    if (a !== "execute" && a !== "execute_contested") {
      console.error(
        `guardmesh-bridge: --strict-final requires finalDecision execute or execute_contested; got "${a ?? ""}".`
      )
      process.exit(1)
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
