"use client"

import { useCallback, useEffect, useState } from "react"
import { useGuardmeshContracts } from "@/hooks/use-guardmesh-contracts"
import type { AuditDecision } from "@/lib/guardmesh-contracts"
import { formatContractError, parseBytes32Hex } from "@/lib/tx-utils"
import { outcomeLabel, GUARDMESH_AUDIT_ADDRESS } from "@/lib/contracts-config"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const PAGE = 20

export default function AuditTrailPage() {
  const { auditRead } = useGuardmeshContracts()
  const [total, setTotal] = useState<number | null>(null)
  const [rows, setRows] = useState<AuditDecision[]>([])
  const [offset, setOffset] = useState(0)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [merkleInput, setMerkleInput] = useState("")
  const [lookupResult, setLookupResult] = useState<AuditDecision | null>(null)
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleData, setBundleData] = useState<any | null>(null)

  const loadPage = useCallback(async () => {
    setLoadErr(null)
    console.log("📄 Loading audit trail page...")
    console.log("   Offset:", offset, "| Page Size:", PAGE)
    
    try {
      const t = await auditRead.getTotalDecisions()
      const totalNum = Number(t)
      setTotal(totalNum)
      console.log("   Total Decisions:", totalNum)

      const [page] = await auditRead.getAllDecisionsPaginated(offset, PAGE)
      const pageData = page as unknown as AuditDecision[]
      setRows(pageData)
      
      console.log("✅ Page loaded:", pageData.length, "decisions")
      if (pageData.length > 0) {
        console.log("   First merkle root:", String(pageData[0].merkleRoot))
        console.log("   Last merkle root:", String(pageData[pageData.length - 1].merkleRoot))
      }
    } catch (e) {
      console.error("❌ Failed to load page:", e)
      setLoadErr(formatContractError(e))
    }
  }, [auditRead, offset])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const onLookup = async () => {
    setLookupResult(null)
    setBundleData(null)
    const root = parseBytes32Hex(merkleInput)
    if (!root) {
      toast.error("Enter a 32-byte hex value: 0x + 64 hex characters.")
      return
    }

    console.log("═══════════════════════════════════════════════════════")
    console.log("🔍 LOOKING UP ON-CHAIN DECISION")
    console.log("═══════════════════════════════════════════════════════")
    console.log("📋 Merkle Root:", root)
    console.log("📍 Contract:", GUARDMESH_AUDIT_ADDRESS)
    console.log("⏰ Timestamp:", new Date().toISOString())

    try {
      console.log("🔄 Checking if decision exists...")
      const exists = await auditRead.decisionExists(root)
      console.log("   Exists:", exists)

      if (!exists) {
        console.warn("⚠️ No decision found at this merkle root")
        toast.message("No decision at this merkle root on-chain.")
        return
      }

      console.log("📥 Fetching decision data...")
      const d = await auditRead.getDecision(root)
      
      console.log("✅ Decision Retrieved")
      console.log("═══════════════════════════════════════════════════════")
      console.log("📊 ON-CHAIN DECISION DATA")
      console.log("═══════════════════════════════════════════════════════")
      console.log("🆔 Agent ID:", d.agentId)
      console.log("🔑 Merkle Root:", String(d.merkleRoot))
      console.log("✓ Approved:", d.approved)
      console.log("📈 Outcome:", d.outcome, `(${outcomeLabel(d.outcome)})`)
      console.log("🎯 Action:", d.actionType, "→", d.target)
      console.log("📊 Votes:", `${d.approveCount} approve / ${d.blockCount} block`)
      console.log("📝 Blocked Reason:", d.blockedReason || "N/A")
      console.log("⏱️ Intent Timestamp:", d.intentTimestamp?.toString?.(), 
        `(${new Date(Number(d.intentTimestamp) * 1000).toISOString()})`)
      console.log("📅 Recorded At:", d.recordedAt?.toString?.(),
        `(${new Date(Number(d.recordedAt) * 1000).toISOString()})`)
      console.log("👤 Recorder:", d.recorder)
      console.log("═══════════════════════════════════════════════════════\n")

      setLookupResult(d as unknown as AuditDecision)
    } catch (e) {
      console.error("❌ LOOKUP ERROR:", e)
      console.error("   Message:", e instanceof Error ? e.message : String(e))
      console.error("   Stack:", e instanceof Error ? e.stack : "N/A")
      toast.error(formatContractError(e))
    }
  }

  const onRetrieveBundle = async () => {
    const root = parseBytes32Hex(merkleInput)
    if (!root) {
      toast.error("Enter a valid merkle root first.")
      return
    }

    console.log("═══════════════════════════════════════════════════════")
    console.log("🔍 RETRIEVING DECISION BUNDLE FROM 0G STORAGE")
    console.log("═══════════════════════════════════════════════════════")
    console.log("📋 Merkle Root:", root)
    console.log("⏰ Timestamp:", new Date().toISOString())

    setBundleLoading(true)
    setBundleData(null)

    try {
      const apiUrl = `/api/guardmesh/retrieve-bundle?merkleRoot=${encodeURIComponent(root)}`
      console.log("🌐 API Request:", apiUrl)
      
      const response = await fetch(apiUrl)
      const data = await response.json()

      console.log("📥 API Response Status:", response.status)
      console.log("📦 Response Data:", data)

      if (!response.ok || !data.ok) {
        console.error("❌ Retrieval Failed")
        console.error("   Stage:", data.stage)
        console.error("   Error:", data.error)
        toast.error(data.error || `Failed to retrieve bundle (${response.status})`)
        return
      }

      console.log("✅ Bundle Retrieved Successfully")
      console.log("═══════════════════════════════════════════════════════")
      console.log("📊 BUNDLE DETAILS")
      console.log("═══════════════════════════════════════════════════════")
      console.log("🔐 Encryption:", data.bundle.encryption)
      console.log("✓ Verified:", data.verified)
      console.log("📝 Verification Notes:", data.verificationNotes)
      
      console.log("\n📋 ON-CHAIN DATA:")
      console.log("   Agent ID:", data.onChainData.agentId)
      console.log("   Action:", data.onChainData.actionType, "→", data.onChainData.target)
      console.log("   Approved:", data.onChainData.approved)
      console.log("   Outcome:", data.onChainData.outcome)
      console.log("   Votes:", `${data.onChainData.approveCount} approve / ${data.onChainData.blockCount} block`)
      console.log("   Recorder:", data.onChainData.recorder)
      console.log("   Intent Timestamp:", new Date(Number(data.onChainData.intentTimestamp) * 1000).toISOString())
      console.log("   Recorded At:", new Date(Number(data.onChainData.recordedAt) * 1000).toISOString())

      console.log("\n🎯 INTENT:")
      console.log(JSON.stringify(data.bundle.intent, null, 2))

      console.log("\n⚖️ VERDICTS:")
      data.bundle.verdicts.forEach((v: any, i: number) => {
        console.log(`\n   Guardian ${i + 1} (${v.peerId?.substring(0, 8)}...):`)
        console.log(`   ├─ Verdict: ${v.verdict}`)
        console.log(`   ├─ Role Check: ${v.role_check}`)
        console.log(`   ├─ Permission Check: ${v.permission_check}`)
        console.log(`   ├─ Content Check: ${v.content_check}`)
        console.log(`   ├─ TEE Verified: ${v.tee_verified ? '✓ YES' : '✗ NO'}`)
        console.log(`   └─ Reason: ${v.reason}`)
      })

      console.log("\n🤝 CONSENSUS:")
      console.log("   Execute:", data.bundle.consensus.execute)
      console.log("   Outcome Code:", data.bundle.consensus.outcomeCode)
      console.log("   Approve Count:", data.bundle.consensus.approveCount)
      console.log("   Block Count:", data.bundle.consensus.blockCount)
      console.log("   Rationale:", data.bundle.consensus.rationale)
      if (data.bundle.consensus.finalDecision) {
        console.log("   Final Decision:")
        console.log("   ├─ Action:", data.bundle.consensus.finalDecision.action)
        console.log("   └─ Agent Instruction:", data.bundle.consensus.finalDecision.agentInstruction)
      }

      console.log("\n🔒 TEE VERIFICATION:")
      data.bundle.teeVerification.forEach((tee: any, i: number) => {
        console.log(`   Guardian ${i + 1} (${tee.peer_id?.substring(0, 8)}...): ${tee.tee_verified ? '✓ VERIFIED' : '✗ NOT VERIFIED'}`)
      })

      console.log("\n⏱️ TIMESTAMPS:")
      console.log("   Decided At:", data.bundle.decidedAtIso)
      console.log("   Unix Timestamp:", data.bundle.decidedAtUnix)

      console.log("═══════════════════════════════════════════════════════")

      setBundleData(data)
      toast.success(data.verified ? "Bundle retrieved and verified ✓" : "Bundle retrieved (verification failed)")
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("❌ RETRIEVAL ERROR:", message)
      console.error("   Stack:", e instanceof Error ? e.stack : "N/A")
      toast.error(`Retrieval error: ${message}`)
    } finally {
      setBundleLoading(false)
      console.log("═══════════════════════════════════════════════════════\n")
    }
  }

  const canPrev = offset > 0
  const canNext = total !== null && offset + PAGE < total

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight">Audit trail</h1>
        <p className="mt-2 text-sm text-black/45 leading-relaxed max-w-2xl">
          Read <strong>GuardMeshAudit</strong> on Galileo (public RPC). Anchors are{" "}
          <code className="text-[11px] bg-black/[0.05] px-1 rounded">{GUARDMESH_AUDIT_ADDRESS}</code>.
        </p>
        <p className="mt-2 text-xs text-black/40">
          <strong>recordDecision</strong> is restricted to authorized recorders (deployer / consensus
          engine). The browser only loads history; it does not submit audit rows unless your wallet was
          whitelisted with <code className="text-[10px]">authorizeRecorder</code>.
        </p>
      </div>

      <section className="rounded-2xl border border-black/[0.07] bg-white/90 p-6 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-black/35">Lookup by merkle root</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 space-y-2">
            <Label className="text-xs">bytes32 merkle root</Label>
            <Input
              value={merkleInput}
              onChange={(e) => setMerkleInput(e.target.value)}
              placeholder="0x…"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void onLookup()}>
              getDecision
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => void onRetrieveBundle()}
              disabled={bundleLoading}
            >
              {bundleLoading ? "Retrieving..." : "Retrieve Bundle"}
            </Button>
          </div>
        </div>
        {lookupResult ? (
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-black/35">On-chain data</h3>
            <pre className="text-[11px] leading-relaxed bg-black/[0.03] rounded-lg p-4 overflow-x-auto font-mono text-black/70">
              {JSON.stringify(
                {
                  agentId: lookupResult.agentId,
                  merkleRoot: String(lookupResult.merkleRoot),
                  approved: lookupResult.approved,
                  outcome: lookupResult.outcome,
                  outcomeLabel: outcomeLabel(lookupResult.outcome),
                  actionType: lookupResult.actionType,
                  target: lookupResult.target,
                  approveCount: lookupResult.approveCount,
                  blockCount: lookupResult.blockCount,
                  blockedReason: lookupResult.blockedReason,
                  intentTimestamp: lookupResult.intentTimestamp?.toString?.(),
                  recordedAt: lookupResult.recordedAt?.toString?.(),
                  recorder: lookupResult.recorder,
                },
                (_, v) => (typeof v === "bigint" ? v.toString() : v),
                2
              )}
            </pre>
          </div>
        ) : null}

        {bundleData ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-black/35">0G Storage Bundle</h3>
              {bundleData.verified ? (
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">✓ Verified</span>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">⚠ Verification Failed</span>
              )}
            </div>
            
            {bundleData.verificationNotes && bundleData.verificationNotes.length > 0 ? (
              <div className="text-[11px] text-black/50 space-y-1">
                {bundleData.verificationNotes.map((note: string, i: number) => (
                  <div key={i}>• {note}</div>
                ))}
              </div>
            ) : null}

            <div className="space-y-4">
              <details className="rounded-lg border border-black/[0.07] bg-white/50">
                <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-black/70 hover:bg-black/[0.02]">
                  Intent
                </summary>
                <pre className="text-[11px] leading-relaxed bg-black/[0.03] p-4 overflow-x-auto font-mono text-black/70 border-t border-black/[0.05]">
                  {JSON.stringify(bundleData.bundle.intent, null, 2)}
                </pre>
              </details>

              <details className="rounded-lg border border-black/[0.07] bg-white/50">
                <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-black/70 hover:bg-black/[0.02]">
                  Verdicts ({bundleData.bundle.verdicts?.length || 0})
                </summary>
                <pre className="text-[11px] leading-relaxed bg-black/[0.03] p-4 overflow-x-auto font-mono text-black/70 border-t border-black/[0.05]">
                  {JSON.stringify(bundleData.bundle.verdicts, null, 2)}
                </pre>
              </details>

              <details className="rounded-lg border border-black/[0.07] bg-white/50">
                <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-black/70 hover:bg-black/[0.02]">
                  Consensus
                </summary>
                <pre className="text-[11px] leading-relaxed bg-black/[0.03] p-4 overflow-x-auto font-mono text-black/70 border-t border-black/[0.05]">
                  {JSON.stringify(bundleData.bundle.consensus, null, 2)}
                </pre>
              </details>

              <details className="rounded-lg border border-black/[0.07] bg-white/50">
                <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-black/70 hover:bg-black/[0.02]">
                  TEE Verification
                </summary>
                <pre className="text-[11px] leading-relaxed bg-black/[0.03] p-4 overflow-x-auto font-mono text-black/70 border-t border-black/[0.05]">
                  {JSON.stringify(bundleData.bundle.teeVerification, null, 2)}
                </pre>
              </details>

              <details className="rounded-lg border border-black/[0.07] bg-white/50">
                <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-black/70 hover:bg-black/[0.02]">
                  Full Bundle (Raw JSON)
                </summary>
                <pre className="text-[11px] leading-relaxed bg-black/[0.03] p-4 overflow-x-auto font-mono text-black/70 border-t border-black/[0.05]">
                  {JSON.stringify(bundleData.bundle, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ) : null}
      </section>

      {loadErr ? <p className="text-sm text-red-700/90">{loadErr}</p> : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs uppercase tracking-widest text-black/35">
            getAllDecisionsPaginated
          </h2>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
              className="px-3 py-1 rounded-lg border border-black/[0.1] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setOffset((o) => o + PAGE)}
              className="px-3 py-1 rounded-lg border border-black/[0.1] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
        <p className="text-xs text-black/35">
          Total on-chain: {total === null ? "—" : total} · offset {offset}
        </p>

        <div className="rounded-2xl border border-black/[0.07] bg-white/90 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-[10px] uppercase tracking-widest text-black/35">
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
                <th className="px-3 py-2 font-medium">Votes</th>
                <th className="px-3 py-2 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.merkleRoot}-${i}`} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-3 py-2">{r.agentId}</td>
                  <td className="px-3 py-2 text-black/55">
                    {r.actionType} → {r.target}
                  </td>
                  <td className="px-3 py-2 text-xs">{outcomeLabel(r.outcome)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-black/45">
                    {r.approveCount}/{r.blockCount}
                  </td>
                  <td className="px-3 py-2 text-[11px] font-mono text-black/40">
                    {Number(r.recordedAt) ? new Date(Number(r.recordedAt) * 1000).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && !loadErr ? (
          <p className="text-sm text-black/40">No decisions in this page range yet.</p>
        ) : null}
      </section>
    </div>
  )
}
