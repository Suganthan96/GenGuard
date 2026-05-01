import { NextResponse } from "next/server"
import type { AgentPolicyContext } from "@/lib/agent-analysis-prompt"
import { runPolicyScopedCodeAnalysis } from "@/lib/guardmesh-openai-analysis"

export const runtime = "nodejs"

type Body = {
  policy?: AgentPolicyContext
  code?: string
  question?: string
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Set OPENAI_API_KEY in Web/.env.local (or your host env) to enable in-dashboard AI analysis.",
      },
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

  try {
    const { analysis, model } = await runPolicyScopedCodeAnalysis({
      policy: {
        agentId: policy.agentId.trim(),
        roleScope: policy.roleScope?.trim() || "unknown",
        allowedActions: Array.isArray(policy.allowedActions) ? policy.allowedActions : [],
      },
      code: typeof body.code === "string" ? body.code : "",
      question: typeof body.question === "string" ? body.question : "",
    })
    return NextResponse.json({ analysis, model })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg.startsWith("OpenAI") ? 502 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
