import type { GuardmeshIntent } from "@/lib/guardmesh-intent"
import { drainVerdictSpoolOnce } from "@/lib/axl-verdict-spool"
import type { VerdictRow } from "@/lib/axl-types"

export type { VerdictRow } from "@/lib/axl-types"

function isAllowedAxlHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
}

export function getAxlHubUrl(): string {
  const raw = process.env.GUARDMESH_AXL_URL?.trim() || "http://127.0.0.1:9002"
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error("Invalid GUARDMESH_AXL_URL")
  }
  if (!isAllowedAxlHost(u.hostname)) {
    throw new Error(
      "GUARDMESH_AXL_URL must use localhost for the dashboard bridge (set explicitly if you need another host)."
    )
  }
  return u.toString().replace(/\/$/, "")
}

type PeerInfo = { public_key?: string; up?: boolean }
type Topology = { our_public_key?: string; peers?: PeerInfo[] }

export async function fetchTopology(axlUrl: string): Promise<Topology> {
  const res = await fetch(`${axlUrl}/topology`, { cache: "no-store" })
  if (!res.ok) throw new Error(`AXL topology failed: ${res.status}`)
  return (await res.json()) as Topology
}

function parsePeerList(): string[] {
  const raw = process.env.GUARDMESH_GUARDIAN_PEER_IDS?.trim()
  if (!raw) return []
  return raw.split(/[\s,]+/).filter(Boolean)
}

export async function resolveGuardianPeerIds(axlUrl: string): Promise<string[]> {
  const fromEnv = parsePeerList()
  if (fromEnv.length) return fromEnv

  const topo = await fetchTopology(axlUrl)
  const self = (topo.our_public_key || "").toLowerCase()
  const rows = topo.peers || []
  const keys = rows
    .map((p) => p.public_key?.trim())
    .filter((k): k is string => !!k && k.toLowerCase() !== self)

  const upFirst = rows
    .filter((p) => p.up)
    .map((p) => p.public_key?.trim())
    .filter((k): k is string => !!k && k.toLowerCase() !== self)

  const ordered = [...new Set([...upFirst, ...keys])]
  const selfRaw = (topo.our_public_key || "").trim()
  // Hub listener uses this node's /recv; it must receive sends too, so include our_public_key
  // when it is not already listed as a peer (topology peers are usually remote spokes only).
  const withSelf =
    selfRaw && !ordered.some((k) => k.toLowerCase() === selfRaw.toLowerCase())
      ? [...ordered, selfRaw]
      : ordered

  if (withSelf.length === 0) {
    throw new Error(
      "No guardian peers: set GUARDMESH_GUARDIAN_PEER_IDS (comma-separated) or start the mesh so /topology lists peers with public_key."
    )
  }
  return withSelf.slice(0, 8)
}

export async function broadcastIntent(axlUrl: string, peerIds: string[], intent: GuardmeshIntent) {
  const envelope = {
    type: "guardmesh_intent",
    timestamp: Date.now(),
    intent,
  }
  const body = JSON.stringify(envelope)
  const results: { peerId: string; ok: boolean; error?: string }[] = []
  const sendTimeoutMs = Math.max(500, Number(process.env.GUARDMESH_AXL_SEND_TIMEOUT_MS) || 4000)

  for (const peerId of peerIds) {
    try {
      const res = await fetch(`${axlUrl}/send`, {
        method: "POST",
        headers: {
          "X-Destination-Peer-Id": peerId,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(sendTimeoutMs),
      })
      if (!res.ok) {
        results.push({ peerId, ok: false, error: `HTTP ${res.status}` })
        continue
      }
      results.push({ peerId, ok: true })
    } catch (e) {
      results.push({
        peerId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return results
}

function recvBodyToJson(text: string): unknown {
  const t = text.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

function pushUniqueVerdict(out: VerdictRow[], seen: Set<string>, row: VerdictRow) {
  const ts = (row.raw as { timestamp?: number } | undefined)?.timestamp ?? ""
  const dedupe = `${row.peerId}:${ts}:${row.verdict}`
  if (seen.has(dedupe)) return
  seen.add(dedupe)
  out.push(row)
}

export async function pollVerdicts(axlUrl: string, expectedCount: number, timeoutMs: number): Promise<VerdictRow[]> {
  const out: VerdictRow[] = []
  const seen = new Set<string>()
  const deadline = Date.now() + timeoutMs
  const useVerdictSpoolOnly = !!process.env.GUARDMESH_VERDICT_SPOOL_PATH?.trim()

  while (Date.now() < deadline && out.length < expectedCount) {
    try {
      for (const row of drainVerdictSpoolOnce()) {
        pushUniqueVerdict(out, seen, row)
        if (out.length >= expectedCount) break
      }
      if (out.length >= expectedCount) break

      if (useVerdictSpoolOnly) {
        await new Promise((r) => setTimeout(r, 120))
        continue
      }

      const res = await fetch(`${axlUrl}/recv`, { cache: "no-store" })
      if (res.status === 204) {
        await new Promise((r) => setTimeout(r, 120))
        continue
      }
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 200))
        continue
      }
      const text = await res.text()
      const from = res.headers.get("x-from-peer-id") || res.headers.get("X-From-Peer-Id") || ""
      const data = recvBodyToJson(text) as {
        type?: string
        verdict?: { verdict?: string; reason?: string }
        tee_verified?: boolean
        timestamp?: number
      } | null
      if (!data || data.type !== "guardmesh_verdict" || !data.verdict?.verdict) {
        await new Promise((r) => setTimeout(r, 80))
        continue
      }
      const row: VerdictRow = {
        peerId: from || "unknown",
        verdict: data.verdict.verdict,
        reason: data.verdict.reason,
        tee_verified: data.tee_verified,
        raw: data,
      }
      pushUniqueVerdict(out, seen, row)
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return out
}
