#!/usr/bin/env node
/**
 * OpenClaw / shell helper: POST the same JSON as the Agent analysis page uses,
 * reading optional GUARDMESH_TOOL_SECRET from Web/.env next to the repo.
 *
 * Usage (from repo root):
 *   node integrations/openclaw/run-code-analysis.mjs body.json
 *   node integrations/openclaw/run-code-analysis.mjs body.json http://127.0.0.1:3000
 *
 * body.json must match POST /api/guardmesh/run/code-analysis (include persistForDashboard: true
 * if you want the dashboard to show the result).
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

function parseDotEnv(contents) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of contents.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 8; i++) {
    const webEnv = path.join(dir, "Web", ".env")
    const webEnvLocal = path.join(dir, "Web", ".env.local")
    if (fs.existsSync(webEnv) || fs.existsSync(webEnvLocal)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(startDir)
}

const bodyPath = process.argv[2]
const baseUrl = (process.argv[3] || process.env.GUARDMESH_WEB_ORIGIN || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
)

if (!bodyPath || !fs.existsSync(bodyPath)) {
  console.error("Usage: node integrations/openclaw/run-code-analysis.mjs <body.json> [baseUrl]")
  console.error("Example: node integrations/openclaw/run-code-analysis.mjs ./body.json")
  process.exit(1)
}

const repoRoot = findRepoRoot(process.cwd())
const envPath = fs.existsSync(path.join(repoRoot, "Web", ".env.local"))
  ? path.join(repoRoot, "Web", ".env.local")
  : path.join(repoRoot, "Web", ".env")

let secret = process.env.GUARDMESH_TOOL_SECRET?.trim() || ""
if (!secret && fs.existsSync(envPath)) {
  const envMap = parseDotEnv(fs.readFileSync(envPath, "utf8"))
  secret = (envMap.GUARDMESH_TOOL_SECRET || "").trim()
}

const rawBody = fs.readFileSync(bodyPath, "utf8")
const url = `${baseUrl}/api/guardmesh/run/code-analysis`

/** @type {Record<string, string>} */
const headers = { "Content-Type": "application/json" }
if (secret) {
  headers.Authorization = `Bearer ${secret}`
}

const res = await fetch(url, { method: "POST", headers, body: rawBody })
const text = await res.text()
let json
try {
  json = JSON.parse(text)
} catch {
  json = { raw: text }
}

if (!res.ok) {
  console.error("Request failed:", res.status, json)
  process.exit(1)
}

console.log(JSON.stringify(json, null, 2))
