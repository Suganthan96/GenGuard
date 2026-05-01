/**
 * Start a Guardian Listener
 * Usage: node start-guardian-listener.js [guardian-id] [axl-api-port]
 *
 * Loads `.env.<guardian-id>` when present (e.g. `.env.guardian-2`), else `.env`.
 * Must run before importing the listener so each process gets its own PRIVATE_KEY.
 */

import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const guardianId = process.argv[2] || "guardian-1"
const axlPort = process.argv[3] || "9002"
const axlApiUrl = `http://127.0.0.1:${axlPort}`

const specific = path.join(__dirname, `.env.${guardianId}`)
const fallback = path.join(__dirname, ".env")
const envPath = fs.existsSync(specific) ? specific : fallback
dotenv.config({ path: envPath })
console.log(`[env] ${path.basename(envPath)}`)

const { GuardianListener } = await import("./axl-guardian-listener.js")

console.log("═══════════════════════════════════════════════════════")
console.log(`  GuardMesh Guardian Listener - ${guardianId}`)
console.log("═══════════════════════════════════════════════════════\n")

const listener = new GuardianListener(guardianId, axlApiUrl)

process.on("SIGINT", () => {
  console.log("\n\nShutting down...")
  listener.stop()
  process.exit(0)
})

process.on("SIGTERM", () => {
  listener.stop()
  process.exit(0)
})

;(async () => {
  try {
    const publicKey = await listener.initialize()
    if (!publicKey || String(publicKey).trim() === '') {
      console.error(`\n❌ Mesh public key missing after init — cannot configure intent broadcasters.`)
      process.exit(1)
    }
    console.log(`\n📋 Share this public key with intent broadcasters:`)
    console.log(`   ${publicKey}\n`)

    await listener.startListening()
  } catch (error) {
    console.error(`\n❌ Failed to start listener: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
})()
