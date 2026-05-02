"use client"

import Link from "next/link"
import { useState } from "react"
import { useWallet } from "@/contexts/wallet-context"

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Agents", href: "#agents" },
  { label: "Workflow", href: "#workflow" },
  { label: "Integrations", href: "#integrations" },
]

const NAV_STYLE = {
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  background: "rgba(245,244,240,0.30)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
} as const

function CtaButton({ className = "" }: { className?: string }) {
  const { address, connecting, error, connect, is0gNetwork } = useWallet()

  if (!address) {
    return (
      <div className={"flex flex-col items-stretch gap-1 " + className}>
        <button
          type="button"
          disabled={connecting}
          onClick={() => {
            void connect()
          }}
          className={
            "text-[11px] px-4 py-2 rounded-xl border border-black/10 text-black/70 hover:text-black hover:border-black/20 hover:bg-black/[0.03] transition-all duration-200 tracking-wide disabled:opacity-50 "
          }
          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          {connecting ? "Check MetaMask…" : "Connect wallet"}
        </button>
        {error ? (
          <p className="text-[10px] text-red-700/90 leading-snug max-w-[min(100%,320px)] break-words">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <Link
      href="/home"
      className={
        "inline-flex items-center justify-center text-[11px] px-4 py-2 rounded-xl border border-black/15 bg-black/[0.04] text-black hover:bg-black/[0.08] transition-all duration-200 tracking-wide " +
        className
      }
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      title={is0gNetwork ? "Open GuardMesh dashboard" : "Switch to 0G Galileo in MetaMask"}
    >
      Start building
    </Link>
  )
}

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl">
        <nav
          className="flex items-center justify-between px-5 py-3 rounded-2xl border border-black/[0.06]"
          style={NAV_STYLE}
        >
          <Link
            href="/"
            className="font-pixel text-xs tracking-[0.25em] text-black/70 hover:text-black"
          >
            GENGUARD
          </Link>

          <div className="hidden md:flex items-center gap-7" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[11px] text-black/60 hover:text-black transition-colors duration-200 tracking-wide"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <CtaButton className="hidden md:inline-flex" />

            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] rounded-lg hover:bg-black/[0.04] transition-colors"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span
                className="block h-px bg-black/60 transition-all duration-300 origin-center"
                style={{
                  width: "18px",
                  transform: open ? "translateY(6px) rotate(45deg)" : "none",
                }}
              />
              <span
                className="block h-px bg-black/60 transition-all duration-300"
                style={{
                  width: "18px",
                  opacity: open ? 0 : 1,
                  transform: open ? "scaleX(0)" : "none",
                }}
              />
              <span
                className="block h-px bg-black/60 transition-all duration-300 origin-center"
                style={{
                  width: "18px",
                  transform: open ? "translateY(-6px) rotate(-45deg)" : "none",
                }}
              />
            </button>
          </div>
        </nav>

        <div
          className="md:hidden mt-2 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open ? "360px" : "0px", opacity: open ? 1 : 0 }}
        >
          <div className="rounded-2xl border border-black/[0.06] px-2 py-2 flex flex-col" style={NAV_STYLE}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={close}
                className="px-4 py-3 text-sm text-black/60 hover:text-black hover:bg-black/[0.03] rounded-xl transition-colors tracking-wide"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-1 px-2 pb-1 pt-2">
              <CtaButton className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
