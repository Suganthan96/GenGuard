import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** If Web/.env.local omits GUARDMESH_KV_WRITER_PRIVATE_KEY, reuse deployer key from 0g-contracts/.env */
function applyKvWriterFrom0gContractsEnv() {
  if (process.env.GUARDMESH_KV_WRITER_PRIVATE_KEY?.trim()) return
  const envPath = path.join(__dirname, "..", "0g-contracts", ".env")
  let text = ""
  try {
    text = fs.readFileSync(envPath, "utf8")
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    if (key !== "PRIVATE_KEY") continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim()
    }
    if (!v || v === "your_private_key_here") return
    process.env.GUARDMESH_KV_WRITER_PRIVATE_KEY = v.startsWith("0x") ? v : `0x${v}`
    return
  }
}

applyKvWriterFrom0gContractsEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  /** 0G Storage SDK pulls Node builtins; keep it external to the server bundle. */
  serverExternalPackages: ["@0gfoundation/0g-ts-sdk"],
}

export default nextConfig
