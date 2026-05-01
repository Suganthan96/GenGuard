import { NextResponse } from "next/server"
import { exec, execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs"
import path from "node:path"
import {
  type ChannelContext,
  channelPolicySummaryForPrompt,
  evaluateChannelGuard,
} from "@/lib/openclaw-channel-guard"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)

type Body = {
  action?: string
  userMessage?: string
  toolResult?: unknown
  agentId?: string
  timeoutSeconds?: number
  channelContext?: ChannelContext
}

function resolveOpenclawBin(): string {
  const fromEnv = process.env.OPENCLAW_CLI_PATH?.trim()
  if (fromEnv) return fromEnv
  const userProfile = process.env.USERPROFILE?.trim() || ""
  if (userProfile) {
    const winNpmCmd = path.join(userProfile, "AppData", "Roaming", "npm", "openclaw.cmd")
    if (fs.existsSync(winNpmCmd)) return winNpmCmd
  }
  const appData = process.env.APPDATA?.trim() || ""
  if (appData) {
    const appDataCmd = path.join(appData, "npm", "openclaw.cmd")
    if (fs.existsSync(appDataCmd)) return appDataCmd
  }
  return "openclaw"
}

function resolveOpenclawModel(): string {
  const fromEnv = process.env.OPENCLAW_REPLY_MODEL?.trim()
  if (fromEnv) return fromEnv
  return "groq/llama-3.3-70b-versatile"
}

function quoteForCmd(x: string): string {
  return `"${String(x).replace(/"/g, '\\"')}"`
}

function isWindowsCmdFile(bin: string): boolean {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(bin)
}

function resolveNodeExe(): string {
  const candidates: string[] = []
  const fromEnv = process.env.OPENCLAW_NODE_PATH?.trim()
  if (fromEnv) candidates.push(fromEnv)
  if (process.platform === "win32") {
    candidates.push("C:\\Program Files\\nodejs\\node.exe")
    const localAppData = process.env.LOCALAPPDATA?.trim() || ""
    if (localAppData) {
      candidates.push(path.join(localAppData, "Programs", "nodejs", "node.exe"))
    }
  }
  candidates.push("node")
  for (const c of candidates) {
    if (c === "node") return c
    if (fs.existsSync(c)) return c
  }
  return "node"
}

function resolveOpenclawDistFromCmd(bin: string): string | null {
  // C:\Users\<u>\AppData\Roaming\npm\openclaw.cmd
  // -> C:\Users\<u>\AppData\Roaming\npm\node_modules\openclaw\dist\index.js
  try {
    const npmBinDir = path.dirname(bin)
    const dist = path.join(npmBinDir, "node_modules", "openclaw", "dist", "index.js")
    return fs.existsSync(dist) ? dist : null
  } catch {
    return null
  }
}

function pickFirstNonEmptyString(node: unknown, depth = 0): string {
  if (depth > 6) return ""
  if (typeof node === "string" && node.trim()) return node.trim()
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = pickFirstNonEmptyString(item, depth + 1)
      if (hit) return hit
    }
    return ""
  }
  if (!node || typeof node !== "object") return ""
  const obj = node as Record<string, unknown>
  const priorityKeys = ["text", "message", "output_text", "reply", "response", "content"]
  for (const k of priorityKeys) {
    const hit = pickFirstNonEmptyString(obj[k], depth + 1)
    if (hit) return hit
  }
  for (const v of Object.values(obj)) {
    const hit = pickFirstNonEmptyString(v, depth + 1)
    if (hit) return hit
  }
  return ""
}

function extractAssistantText(parsed: unknown): string {
  return pickFirstNonEmptyString(parsed)
}

function buildPrompt(body: Body): string {
  const action = String(body.action || "unknown")
  const userMessage = String(body.userMessage || "").trim()
  const result = JSON.stringify(body.toolResult ?? {}, null, 2).slice(0, 12000)
  return [
    "You are the OpenClaw assistant for GuardMesh dashboard chat.",
    "The tool execution is already completed and approved by GuardMesh.",
    body.channelContext
      ? channelPolicySummaryForPrompt(body.channelContext, evaluateChannelGuard(body.channelContext))
      : "Enterprise channel guard context: channel=dashboard-local",
    "Give a practical, structured answer for the user.",
    "",
    `Action: ${action}`,
    `User request: ${userMessage || "(empty)"}`,
    "Tool result JSON:",
    result,
    "",
    "Return sections in this order:",
    "1) Summary",
    "2) Findings",
    "3) Risks",
    "4) Next Steps",
  ].join("\n")
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const bin = resolveOpenclawBin()
  const model = resolveOpenclawModel()
  const targetAgent = body.agentId?.trim() || process.env.OPENCLAW_GUARDMESH_AGENT_ID?.trim() || "guardmesh-ops"
  const timeout = Math.max(30, Math.min(300, Number(body.timeoutSeconds) || 90))

  if (body.channelContext) {
    const gate = evaluateChannelGuard(body.channelContext)
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          framework: "openclaw",
          blocked: true,
          stage: "enterprise_channel_guard",
          reason: gate.reason,
          channel: body.channelContext.channel,
          policy: gate.policy,
        },
        { status: 403 }
      )
    }
  }

  const prompt = buildPrompt(body)

  const args = [
    "agent",
    "--local",
    "--agent",
    targetAgent,
    "--message",
    prompt,
    "--model",
    model,
    "--json",
    "--timeout",
    String(timeout),
  ]

  try {
    const env = {
      ...process.env,
      GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    }
    const commonOpts = {
      env,
      timeout: (timeout + 10) * 1000,
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    } as const

    let stdout = ""
    let stderr = ""
    if (isWindowsCmdFile(bin)) {
      const dist = resolveOpenclawDistFromCmd(bin)
      if (dist) {
        const nodeExe = resolveNodeExe()
        const out = await execFileAsync(nodeExe, [dist, ...args], commonOpts)
        stdout = String(out.stdout || "")
        stderr = String(out.stderr || "")
      } else {
        // Fallback path if dist cannot be resolved.
        const cmdline = [quoteForCmd(bin), ...args.map(quoteForCmd)].join(" ")
        const out = await execAsync(cmdline, commonOpts)
        stdout = String(out.stdout || "")
        stderr = String(out.stderr || "")
      }
    } else {
      const out = await execFileAsync(bin, args, commonOpts)
      stdout = String(out.stdout || "")
      stderr = String(out.stderr || "")
    }

    let parsed: unknown = null
    const outText = String(stdout || "").trim()
    if (outText) {
      try {
        parsed = JSON.parse(outText)
      } catch {
        parsed = { raw: outText }
      }
    }

    const text = extractAssistantText(parsed) || outText || String(stderr || "").trim()
    return NextResponse.json({
      ok: true,
      framework: "openclaw",
      agent: targetAgent,
      mode: "local",
      model,
      text,
      raw: parsed,
    })
  } catch (e) {
    const err = e as Error & { stdout?: string; stderr?: string }
    return NextResponse.json(
      {
        ok: false,
        framework: "openclaw",
        agent: targetAgent,
        mode: "local",
        model,
        error: err.message,
        stdout: String(err.stdout || "").slice(0, 4000),
        stderr: String(err.stderr || "").slice(0, 4000),
      },
      { status: 502 }
    )
  }
}
