import { NextResponse } from "next/server"
import { getOpenclawDashboardAnalysis } from "@/lib/guardmesh-openclaw-analysis-store"

export const runtime = "nodejs"

/** Poll latest persisted code-analysis for an agent (see persistForDashboard on code-analysis POST). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")?.trim()
  if (!agentId) {
    return NextResponse.json({ error: "agentId query parameter is required" }, { status: 400 })
  }
  const row = getOpenclawDashboardAnalysis(agentId)
  if (!row) {
    return NextResponse.json({ ok: true, hasData: false, agentId })
  }
  return NextResponse.json({ ok: true, hasData: true, ...row })
}
