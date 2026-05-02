"use client"

import { useEffect, useState } from "react"
import { useGuardmeshContracts } from "@/hooks/use-guardmesh-contracts"

export function ChainStats() {
  const { registryRead, auditRead } = useGuardmeshContracts()
  const [agents, setAgents] = useState<number | null>(null)
  const [decisions, setDecisions] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ac, td] = await Promise.all([
          registryRead.getAgentCount(),
          auditRead.getTotalDecisions(),
        ])
        if (!cancelled) {
          setAgents(Number(ac))
          setDecisions(Number(td))
        }
      } catch (e) {
        if (!cancelled) setErr("Could not load on-chain stats.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [registryRead, auditRead])

  if (err) return <p className="text-xs text-black/35">{err}</p>

  return (
    <div className="flex flex-wrap gap-8 text-sm">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-black/35">Agents on-chain</div>
        <div className="text-2xl font-light mt-1">{agents === null ? "—" : agents}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-black/35">Decisions anchored</div>
        <div className="text-2xl font-light mt-1">{decisions === null ? "—" : decisions}</div>
      </div>
    </div>
  )
}
