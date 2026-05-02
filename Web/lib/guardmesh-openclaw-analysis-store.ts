/**
 * In-memory latest code-analysis result per agent, for dashboard polling after an OpenClaw
 * (or any client) calls POST /api/guardmesh/run/code-analysis with persistForDashboard: true.
 * Clears when the dev server restarts.
 */
export type OpenclawAnalysisRecord = {
  agentId: string
  analysis: string
  model: string
  question: string
  code: string
  updatedAt: string
}

const MAX_CODE_STORE = 200_000

const byAgent = new Map<string, OpenclawAnalysisRecord>()

export function persistOpenclawDashboardAnalysis(args: {
  agentId: string
  analysis: string
  model: string
  question: string
  code: string
}): void {
  const agentId = args.agentId.trim()
  if (!agentId) return
  let code = args.code
  if (code.length > MAX_CODE_STORE) {
    code = code.slice(0, MAX_CODE_STORE) + "\n\n[…truncated for dashboard store cap…]"
  }
  byAgent.set(agentId, {
    agentId,
    analysis: args.analysis,
    model: args.model,
    question: args.question,
    code,
    updatedAt: new Date().toISOString(),
  })
}

export function getOpenclawDashboardAnalysis(agentId: string): OpenclawAnalysisRecord | null {
  return byAgent.get(agentId.trim()) ?? null
}
