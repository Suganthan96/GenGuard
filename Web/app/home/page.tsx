import Link from "next/link"
import { ChainStats } from "@/components/chain-stats"
import { ACTIVITY_ROWS, GUARDIAN_NODES } from "@/lib/dashboard-mock-data"

export default function HomeOverviewPage() {
  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight">Overview</h1>
        <p className="mt-2 text-sm text-black/45 leading-relaxed max-w-xl">
          Live guardian mesh over Gensyn AXL, sealed inference on 0G Compute, and
          chain-anchored receipts on 0G Galileo — per{" "}
          <span className="text-black/55">GuardMesh_Full_Description.md</span>.
        </p>
      </div>

      <section className="rounded-2xl border border-black/[0.07] bg-white/80 p-6 shadow-sm">
        <h2 className="text-sm font-medium tracking-wide text-black/50 uppercase mb-4">
          On-chain (Galileo)
        </h2>
        <ChainStats />
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { k: "Guardian nodes", v: "3", sub: "AXL hub + spokes" },
          { k: "Last verdict", v: "BLOCK", sub: "Meta-class scenario" },
          { k: "Chain", v: "0G", sub: "Galileo testnet" },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-2xl border border-black/[0.07] bg-white/80 p-5 shadow-sm"
          >
            <div className="text-[10px] uppercase tracking-widest text-black/35">{s.k}</div>
            <div className="mt-2 text-2xl font-light">{s.v}</div>
            <div className="text-xs text-black/40 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-sm font-medium tracking-wide text-black/50 uppercase">
            Recent activity
          </h2>
          <Link href="/home/activity" className="text-xs text-black/40 hover:text-black underline-offset-2 hover:underline">
            Open feed →
          </Link>
        </div>
        <ul className="rounded-2xl border border-black/[0.07] bg-white/80 divide-y divide-black/[0.05]">
          {ACTIVITY_ROWS.slice(0, 2).map((row) => (
            <li key={row.id} className="px-4 py-3 flex flex-wrap gap-2 items-center justify-between text-sm">
              <span className="font-mono text-[11px] text-black/35">{row.time}</span>
              <span className="text-black/70">{row.agentId}</span>
              <span className="text-black/45">{row.action}</span>
              <span
                className={
                  row.outcome === "blocked"
                    ? "text-red-700/90 text-xs"
                    : row.outcome === "approved"
                      ? "text-emerald-800/90 text-xs"
                      : "text-amber-800/90 text-xs"
                }
              >
                {row.outcome}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-sm font-medium tracking-wide text-black/50 uppercase">
            Guardians
          </h2>
          <Link href="/home/guardians" className="text-xs text-black/40 hover:text-black underline-offset-2 hover:underline">
            Mesh status →
          </Link>
        </div>
        <ul className="rounded-2xl border border-black/[0.07] bg-white/80 divide-y divide-black/[0.05]">
          {GUARDIAN_NODES.map((g) => (
            <li key={g.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{g.label}</span>
              <span className="text-xs text-black/40">:{g.apiPort}</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {g.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
