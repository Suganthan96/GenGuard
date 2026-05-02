"use client"

import { useEffect, useMemo, useState } from "react"
import { useGuardmeshContracts } from "@/hooks/use-guardmesh-contracts"
import type { AuditDecision } from "@/lib/guardmesh-contracts"
import { cn } from "@/lib/utils"

type RetrievedBundle = {
  ok: boolean
  bundle?: Record<string, unknown>
  onChainData?: Record<string, unknown>
  verified?: boolean
  verificationNotes?: string[]
  error?: string
}

type FeedRow = {
  id: string
  time: string
  agentId: string
  action: string
  target: string
  votes: string
  outcome: "blocked" | "approved" | "pending"
  summary: string
  decision: AuditDecision
}

function mapOutcome(outcome: number, approved: boolean): "blocked" | "approved" | "pending" {
  if (outcome === 1 || approved) return "approved"
  if (outcome === 2) return "blocked"
  return "pending"
}

function asDecision(raw: any): AuditDecision {
  return {
    agentId: String(raw.agentId ?? ""),
    merkleRoot: String(raw.merkleRoot ?? ""),
    approved: Boolean(raw.approved),
    outcome: Number(raw.outcome ?? 0),
    actionType: String(raw.actionType ?? ""),
    target: String(raw.target ?? ""),
    approveCount: Number(raw.approveCount ?? 0),
    blockCount: Number(raw.blockCount ?? 0),
    blockedReason: String(raw.blockedReason ?? ""),
    intentTimestamp: BigInt(raw.intentTimestamp ?? 0),
    recordedAt: BigInt(raw.recordedAt ?? 0),
    recorder: String(raw.recorder ?? ""),
  }
}

export default function ActivityFeedPage() {
  const { auditRead } = useGuardmeshContracts()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<FeedRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleData, setBundleData] = useState<RetrievedBundle | null>(null)

  const row = rows.find((r) => r.id === selected) ?? null

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [page] = await auditRead.getAllDecisionsPaginated(0, 30)
        const list = (page as any[]).map(asDecision)
        const mapped: FeedRow[] = list.map((d) => {
          const state = mapOutcome(d.outcome, d.approved)
          return {
            id: d.merkleRoot,
            time: new Date(Number(d.recordedAt) * 1000).toLocaleString(),
            agentId: d.agentId,
            action: d.actionType,
            target: d.target || "(none)",
            votes: `${d.approveCount}/${d.blockCount} approve/block`,
            outcome: state,
            summary: d.blockedReason || (state === "approved" ? "Consensus approved." : "Pending review."),
            decision: d,
          }
        })
        if (!alive) return
        setRows(mapped)
        setSelected((prev) => prev ?? mapped[0]?.id ?? null)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [auditRead])

  useEffect(() => {
    let alive = true
    async function loadBundle() {
      if (!row?.decision.merkleRoot) {
        setBundleData(null)
        return
      }
      setBundleLoading(true)
      try {
        const res = await fetch(
          `/api/guardmesh/retrieve-bundle?merkleRoot=${encodeURIComponent(row.decision.merkleRoot)}`
        )
        const data = (await res.json().catch(() => ({}))) as RetrievedBundle
        if (!alive) return
        setBundleData(data)
      } catch (e) {
        if (!alive) return
        setBundleData({ ok: false, error: e instanceof Error ? e.message : String(e) })
      } finally {
        if (alive) setBundleLoading(false)
      }
    }
    void loadBundle()
    return () => {
      alive = false
    }
  }, [row?.decision.merkleRoot])

  const detailJson = useMemo(() => {
    if (!row) return null
    if (bundleData?.ok && bundleData.bundle) {
      return {
        bundle: bundleData.bundle,
        onChainData: bundleData.onChainData,
        verified: bundleData.verified,
        verificationNotes: bundleData.verificationNotes,
      }
    }
    // Convert BigInt values to strings for JSON serialization
    const decisionWithStrings = {
      ...row.decision,
      intentTimestamp: row.decision.intentTimestamp.toString(),
      recordedAt: row.decision.recordedAt.toString(),
    }
    return {
      decision: decisionWithStrings,
      bundleError: bundleData?.error || "Bundle unavailable",
    }
  }, [row, bundleData])

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-light tracking-tight">Activity feed</h1>
      <p className="mt-2 text-sm text-black/45 max-w-2xl leading-relaxed">
        Real stream from GuardMesh audit history (on-chain + bundle retrieval).
        Click a row for intent payload, guardian votes, and 0G receipt details.
      </p>

      <div className="mt-8 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-2">
          {loading ? <p className="text-sm text-black/40 px-1 py-2">Loading activity…</p> : null}
          {error ? <p className="text-sm text-red-700/90 px-1 py-2">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="text-sm text-black/40 px-1 py-2">No audit decisions found yet.</p>
          ) : null}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              className={cn(
                "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                selected === r.id
                  ? "border-black/20 bg-white shadow-sm"
                  : "border-black/[0.06] bg-white/60 hover:bg-white/90"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-black/35">{r.time}</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider",
                    r.outcome === "blocked" && "text-red-700",
                    r.outcome === "approved" && "text-emerald-800",
                    r.outcome === "pending" && "text-amber-800"
                  )}
                >
                  {r.outcome}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium text-black/80">{r.agentId}</div>
              <div className="text-xs text-black/45 mt-0.5">
                {r.action} → {r.target}
              </div>
              <div className="text-[11px] text-black/35 mt-1">{r.votes}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-black/[0.07] bg-white/90 p-6 min-h-[280px]">
          {row ? (
            <div className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-black/35">Detail panel</h2>
              {bundleLoading ? <p className="text-xs text-black/45">Loading bundle…</p> : null}
              <pre className="text-[11px] leading-relaxed bg-black/[0.03] rounded-lg p-4 overflow-x-auto font-mono text-black/60">
                {JSON.stringify(detailJson, null, 2)}
              </pre>
              <a
                className="inline-flex text-xs text-black/50 hover:text-black underline-offset-2 hover:underline"
                href="https://chainscan-galileo.0g.ai"
                target="_blank"
                rel="noreferrer"
              >
                Open 0G explorer (Galileo) →
              </a>
              <p className="text-[11px] text-black/40 font-mono break-all">
                Merkle root: {row.decision.merkleRoot}
              </p>
            </div>
          ) : (
            <p className="text-sm text-black/40">Select an event.</p>
          )}
        </div>
      </div>
    </div>
  )
}
