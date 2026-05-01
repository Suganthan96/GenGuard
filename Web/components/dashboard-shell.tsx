"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useWallet } from "@/contexts/wallet-context"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Radio, Shield, ScrollText, FileJson2, Sparkles } from "lucide-react"

const NAV = [
  { href: "/home", label: "Overview", icon: LayoutDashboard },
  { href: "/home/analyze", label: "Agent analysis", icon: Sparkles },
  { href: "/home/activity", label: "Activity feed", icon: Radio },
  { href: "/home/guardians", label: "Guardians", icon: Shield },
  { href: "/home/audit", label: "Audit trail", icon: ScrollText },
  { href: "/home/policies", label: "Policy editor", icon: FileJson2 },
]

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { address, is0gNetwork, disconnect } = useWallet()

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-black/[0.08] bg-white/70 backdrop-blur-md px-4 py-6 md:min-h-screen">
        <Link
          href="/"
          className="font-pixel text-[10px] tracking-[0.2em] text-black/50 hover:text-black/80 block mb-8"
        >
          ← GENGUARD
        </Link>
        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs tracking-wide whitespace-nowrap transition-colors",
                  active
                    ? "bg-black/[0.07] text-black font-medium"
                    : "text-black/45 hover:text-black hover:bg-black/[0.04]"
                )}
              >
                <Icon className="size-3.5 opacity-60 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-black/[0.08] bg-white/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-8">
          <span className="text-[11px] tracking-widest text-black/35 uppercase">
            GuardMesh dashboard
          </span>
          <div className="flex items-center gap-3 text-xs">
            {address ? (
              <>
                <span
                  className={cn(
                    "hidden sm:inline rounded-full px-2 py-0.5 border text-[10px] tracking-wide",
                    is0gNetwork
                      ? "border-emerald-500/30 text-emerald-800 bg-emerald-500/10"
                      : "border-amber-500/30 text-amber-900 bg-amber-500/10"
                  )}
                >
                  {is0gNetwork ? "0G Galileo" : "Wrong network"}
                </span>
                <span className="font-mono text-black/60">{shortAddr(address)}</span>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="text-black/40 hover:text-black underline-offset-2 hover:underline"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <span className="text-black/35">Wallet not linked on this view</span>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
