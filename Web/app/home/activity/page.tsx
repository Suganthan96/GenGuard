"use client"

import { useState } from "react"
import { ACTIVITY_ROWS } from "@/lib/dashboard-mock-data"
import { cn } from "@/lib/utils"

export default function ActivityFeedPage() {
  const [selected, setSelected] = useState<string | null>(ACTIVITY_ROWS[0]?.id ?? null)
  const row = ACTIVITY_ROWS.find((r) => r.id === selected)

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-light tracking-tight">Activity feed</h1>
      <p className="mt-2 text-sm text-black/45 max-w-2xl leading-relaxed">
        Real-time stream of intercepted intents: colour-coded blocked / pending / approved.
        Click a row for intent payload, guardian votes, and 0G receipt link (mock UI).
      </p>

      <div className="mt-8 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-2">
          {ACTIVITY_ROWS.map((r) => (
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
              <pre className="text-[11px] leading-relaxed bg-black/[0.03] rounded-lg p-4 overflow-x-auto font-mono text-black/60">
                {JSON.stringify(
                  {
                    intent: {
                      agent_id: row.agentId,
                      action_type: row.action,
                      target: row.target,
                      content: "…",
                      data_touched: ["user_metrics_table"],
                      role_scope: "code_analysis_only",
                    },
                    votes: row.votes,
                    outcome: row.outcome,
                    reason: row.summary,
                  },
                  null,
                  2
                )}
              </pre>
              <a
                className="inline-flex text-xs text-black/50 hover:text-black underline-offset-2 hover:underline"
                href="https://chainscan-galileo.0g.ai"
                target="_blank"
                rel="noreferrer"
              >
                Open 0G explorer (Galileo) →
              </a>
            </div>
          ) : (
            <p className="text-sm text-black/40">Select an event.</p>
          )}
        </div>
      </div>
    </div>
  )
}
