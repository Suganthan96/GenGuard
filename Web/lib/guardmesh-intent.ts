/** Payload shape guardians + axl-intent-client expect (see GuardMesh_Full_Description.md). */
export type GuardmeshIntent = {
  agent_id: string
  action_type: string
  target: string
  content: string
  data_touched: string[]
  role_scope: string
  /** Extra context for guardians / audit */
  analysis_excerpt?: string
  /** Optional: OpenClaw (or other runtime) summary — guardians use in content check */
  openclaw_stats?: {
    files_read?: number
    db_queries?: number
    code_analysis_runs?: number
    notes?: string
  }
}

export function buildIntentFromAnalysis(args: {
  agentId: string
  roleScope: string
  actionType: string
  target: string
  code: string
  question: string
  analysis: string
}): GuardmeshIntent {
  const excerpt = args.analysis.slice(0, 4000)
  return {
    agent_id: args.agentId,
    action_type: args.actionType || "code_analysis",
    target: args.target || "workspace",
    content: [args.question && `Q: ${args.question}`, "", "Code:", args.code].filter(Boolean).join("\n").slice(0, 8000),
    data_touched: [],
    role_scope: args.roleScope,
    analysis_excerpt: excerpt,
  }
}
