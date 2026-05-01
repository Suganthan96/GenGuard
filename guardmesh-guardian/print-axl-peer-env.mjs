#!/usr/bin/env node
/**
 * Print GUARDMESH_GUARDIAN_PEER_IDS for Web/.env from AXL hub /topology.
 *
 * Usage:
 *   node print-axl-peer-env.mjs
 *   node print-axl-peer-env.mjs http://127.0.0.1:9002
 *
 * Copies peer public_keys (excluding the hub's our_public_key), preferring peers that report up.
 * Paste the printed line into Web/.env or Web/.env.local next to GUARDMESH_AXL_URL.
 */

const base = (process.argv[2] || "http://127.0.0.1:9002").replace(/\/$/, "")

async function main() {
  const res = await fetch(`${base}/topology`, { cache: "no-store" })
  if (!res.ok) {
    console.error(`topology HTTP ${res.status} — is the hub AXL node running on ${base}?`)
    process.exit(1)
  }
  const topo = await res.json()
  const self = (topo.our_public_key || "").trim().toLowerCase()
  const rows = Array.isArray(topo.peers) ? topo.peers : []
  const keys = rows
    .map((p) => (p.public_key || "").trim())
    .filter((k) => k && k.toLowerCase() !== self)

  const upFirst = rows
    .filter((p) => p.up)
    .map((p) => (p.public_key || "").trim())
    .filter((k) => k && k.toLowerCase() !== self)

  const ordered = [...new Set([...upFirst, ...keys])]
  const selfRaw = (topo.our_public_key || "").trim()
  const withSelf =
    selfRaw && !ordered.some((k) => k.toLowerCase() === selfRaw.toLowerCase())
      ? [...ordered, selfRaw]
      : ordered

  console.log(`# Hub: ${base}`)
  console.log(`# Remote peers (public_key): ${ordered.length}; with hub listener key: ${withSelf.length}`)
  if (withSelf.length === 0) {
    console.error("No keys found. Start AXL + listeners, then retry.")
    process.exit(2)
  }
  const line = withSelf.join(",")
  console.log("")
  console.log(`GUARDMESH_GUARDIAN_PEER_IDS=${line}`)
  console.log("")
  console.log("Add the line above to Web/.env or Web/.env.local (with GUARDMESH_AXL_URL=http://127.0.0.1:9002).")
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
