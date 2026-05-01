/**
 * Hub AXL /recv is shared: the guardian listener dequeues `guardmesh_verdict` messages
 * before Next.js can read them. Those verdicts are appended to `guardmesh-guardian/.verdict-spool.ndjson`.
 * `pollVerdicts` drains this file each loop so the intent API still collects all votes.
 */

import fs from "fs"
import path from "path"
import type { VerdictRow } from "@/lib/axl-types"

function resolveSpoolPath(): string | null {
  const fromEnv = process.env.GUARDMESH_VERDICT_SPOOL_PATH?.trim()
  if (fromEnv) return fromEnv

  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, "..", "guardmesh-guardian", ".verdict-spool.ndjson"),
    path.join(cwd, "guardmesh-guardian", ".verdict-spool.ndjson"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return path.join(cwd, "..", "guardmesh-guardian", ".verdict-spool.ndjson")
}

function lineToVerdictRow(msg: Record<string, unknown>): VerdictRow | null {
  if (msg.type !== "guardmesh_verdict") return null
  const inner = msg.verdict as { verdict?: string; reason?: string } | undefined
  const vs = inner?.verdict?.trim()
  if (!vs) return null
  const from =
    (typeof msg.fromPeerId === "string" && msg.fromPeerId) ||
    (typeof msg.guardian_key === "string" && msg.guardian_key) ||
    ""
  return {
    peerId: from || "unknown",
    verdict: vs.toUpperCase(),
    reason: typeof inner?.reason === "string" ? inner.reason : undefined,
    tee_verified: typeof msg.tee_verified === "boolean" ? msg.tee_verified : undefined,
    raw: msg,
  }
}

/**
 * Read and clear the NDJSON spool (same contract as `guardmesh-guardian/verdict-spool.js` drain).
 */
export function drainVerdictSpoolOnce(): VerdictRow[] {
  const spoolPath = resolveSpoolPath()
  if (!spoolPath || !fs.existsSync(spoolPath)) return []

  let raw: string
  try {
    raw = fs.readFileSync(spoolPath, "utf8")
    fs.writeFileSync(spoolPath, "", "utf8")
  } catch {
    return []
  }

  const out: VerdictRow[] = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t) continue
    try {
      const msg = JSON.parse(t) as Record<string, unknown>
      const row = lineToVerdictRow(msg)
      if (row) out.push(row)
    } catch {
      /* skip */
    }
  }
  return out
}
