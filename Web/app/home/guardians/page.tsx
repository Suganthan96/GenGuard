import { GUARDIAN_NODES } from "@/lib/dashboard-mock-data"

export default function GuardiansPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl md:text-3xl font-light tracking-tight">Guardians</h1>
      <p className="mt-2 text-sm text-black/45 leading-relaxed max-w-2xl">
        Each node is an AXL identity (ed25519 public key). No central coordinator — the mesh
        carries intents and verdicts. Below mirrors the three-localhost setup (9002 / 9012 / 9022).
      </p>

      <ul className="mt-8 space-y-4">
        {GUARDIAN_NODES.map((g) => (
          <li
            key={g.id}
            className="rounded-2xl border border-black/[0.07] bg-white/90 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="font-medium">{g.label}</span>
                <span className="text-xs text-black/35">HTTP {g.apiPort}</span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-black/45 break-all">
                axl://pk-{g.publicKey}
              </div>
              <div className="mt-1 text-xs text-black/40">{g.model}</div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center md:text-right text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-black/35">Votes</div>
                <div className="font-light text-lg">{g.votes}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-black/35">Uptime</div>
                <div className="font-light text-lg">{g.uptime}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-black/35">Block rate</div>
                <div className="font-light text-lg">{g.blockRate}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
