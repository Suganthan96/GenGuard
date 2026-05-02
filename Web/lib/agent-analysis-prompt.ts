export type AgentPolicyContext = {
  agentId: string
  roleScope: string
  allowedActions: string[]
}

export function buildAnalysisMessages(
  policy: AgentPolicyContext,
  code: string,
  question: string
): { role: "system" | "user"; content: string }[] {
  const system = [
    "You are GenGuard's in-dashboard code analyst.",
    "The agent is registered on-chain with this policy — stay within it when giving operational advice.",
    `Agent ID: ${policy.agentId}`,
    `Role scope: ${policy.roleScope}`,
    `Allowed actions: ${policy.allowedActions.join(", ") || "(none listed)"}`,
    "",
    "Respond with exactly these sections and enough detail to be actionable:",
    "1) Summary",
    "- 2-4 sentences describing what the code does and the key outcome.",
    "2) Detailed Findings",
    "- 3-6 bullets covering behavior, edge cases, and notable implementation details.",
    "3) Risks & Policy Conflicts",
    "- 1-5 bullets. If none, write `- none`.",
    "4) Recommended Next Steps",
    "- 2-5 concrete steps (tests, refactors, validation checks, or follow-up actions).",
    "5) GuardMesh Intent",
    "- One final line in this exact format:",
    "action_type=<code_analysis|read_file|query_db>, target=<specific file/path/db target>",
  ].join("\n")

  const user = [
    "### Question",
    question.trim() || "(no question — review the code only)",
    "",
    "### Code / context",
    "```",
    code.trim() || "(empty)",
    "```",
  ].join("\n")

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}
