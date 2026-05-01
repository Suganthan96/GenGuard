import { NextResponse } from "next/server"
import type { AgentPolicyContext } from "@/lib/agent-analysis-prompt"
import { runPolicyScopedCodeAnalysis } from "@/lib/guardmesh-openai-analysis"
import { gatherCodeFromWorkspacePaths } from "@/lib/guardmesh-read-workspace-files"
import { assertToolAuthorized } from "@/lib/guardmesh-tool-auth"
import { persistOpenclawDashboardAnalysis } from "@/lib/guardmesh-openclaw-analysis-store"

export const runtime = "nodejs"

type Body = {
  policy?: AgentPolicyContext
  /** Inline source / snippet (optional if `path` or `paths` is set). */
  code?: string
  question?: string
  /** Single workspace-relative or absolute-under-root file to load server-side. */
  path?: string
  /** Multiple files to load and concatenate for analysis. */
  paths?: string[]
  /**
   * When true, the result is saved for GET /api/guardmesh/analysis/latest so the Agent analysis
   * dashboard can show it after an OpenClaw exec/curl run (in-memory until server restart).
   */
  persistForDashboard?: boolean
}

function normalizePaths(body: Body): string[] {
  const out: string[] = []
  const p = typeof body.path === "string" ? body.path.trim() : ""
  if (p) out.push(p)
  if (Array.isArray(body.paths)) {
    for (const x of body.paths) {
      if (typeof x === "string" && x.trim()) out.push(x.trim())
    }
  }
  return out
}

export async function POST(req: Request) {
  const denied = assertToolAuthorized(req)
  if (denied) return denied

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set on the server" },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const policy = body.policy
  if (!policy?.agentId?.trim()) {
    return NextResponse.json({ error: "policy.agentId is required" }, { status: 400 })
  }

  const filePaths = normalizePaths(body)
  const inline = typeof body.code === "string" ? body.code.trim() : ""

  let sources: Awaited<ReturnType<typeof gatherCodeFromWorkspacePaths>> | null = null
  if (filePaths.length > 0) {
    try {
      sources = await gatherCodeFromWorkspacePaths(filePaths)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  const blocks: string[] = []
  if (sources?.combined?.trim()) blocks.push(sources.combined.trim())
  if (inline) blocks.push("// === inline code ===\n" + inline)

  const code = blocks.join("\n\n").trim()
  if (!code) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of: non-empty `code`, or `path`, or `paths` (workspace files to read server-side).",
      },
      { status: 400 }
    )
  }

  try {
    const q = typeof body.question === "string" ? body.question : ""
    const { analysis, model } = await runPolicyScopedCodeAnalysis({
      policy: {
        agentId: policy.agentId.trim(),
        roleScope: policy.roleScope?.trim() || "unknown",
        allowedActions: Array.isArray(policy.allowedActions) ? policy.allowedActions : [],
      },
      code,
      question: q,
    })
    if (body.persistForDashboard === true) {
      persistOpenclawDashboardAnalysis({
        agentId: policy.agentId.trim(),
        analysis,
        model,
        question: q,
        code,
      })
    }
    return NextResponse.json({
      action: "code_analysis",
      analysis,
      model,
      persisted: body.persistForDashboard === true,
      sources: sources
        ? { files: sources.files.map((f) => ({ path: f.path, bytes: f.bytes, truncated: f.truncated })) }
        : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg.startsWith("OpenAI") ? 502 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
