/** Demo rows aligned with GuardMesh_Full_Description.md — replace with AXL / 0G APIs later */

export type Outcome = "blocked" | "approved" | "pending"

export const ACTIVITY_ROWS = [
  {
    id: "evt-1",
    time: "2026-04-24 14:22:01",
    agentId: "eng-assistant-04",
    action: "forum_post",
    target: "internal-engineering-forum",
    votes: "0/3 approve",
    outcome: "blocked" as Outcome,
    summary: "Role scope violation: code_analysis_only vs forum_post",
  },
  {
    id: "evt-2",
    time: "2026-04-24 14:05:33",
    agentId: "eng-assistant-04",
    action: "code_analysis",
    target: "auth_module.py",
    votes: "3/3 approve",
    outcome: "approved" as Outcome,
    summary: "All checks passed; TEE-verified verdicts",
  },
  {
    id: "evt-3",
    time: "2026-04-24 13:58:12",
    agentId: "data-bot-02",
    action: "change_permissions",
    target: "iam-console",
    votes: "2/3 block",
    outcome: "pending" as Outcome,
    summary: "Held for human review (majority block)",
  },
] as const

export const GUARDIAN_NODES = [
  {
    id: "g1",
    label: "Guardian 1 (hub)",
    apiPort: 9002,
    publicKey: "62bc…7602",
    model: "qwen-2.5-7b-instruct (TeeML)",
    status: "online" as const,
    votes: 1284,
    uptime: "99.2%",
    blockRate: "12%",
  },
  {
    id: "g2",
    label: "Guardian 2",
    apiPort: 9012,
    publicKey: "5343…6af2",
    model: "qwen-2.5-7b-instruct (TeeML)",
    status: "online" as const,
    votes: 1198,
    uptime: "98.7%",
    blockRate: "14%",
  },
  {
    id: "g3",
    label: "Guardian 3",
    apiPort: 9022,
    publicKey: "588e…9e2",
    model: "qwen-2.5-7b-instruct (TeeML)",
    status: "online" as const,
    votes: 1201,
    uptime: "99.0%",
    blockRate: "11%",
  },
] as const

export const AUDIT_ROWS = [
  {
    id: "a1",
    time: "2026-04-24T14:22:01Z",
    agentId: "eng-assistant-04",
    action: "forum_post",
    outcome: "blocked" as Outcome,
    receipt: "0x7f2a…c91d",
  },
  {
    id: "a2",
    time: "2026-04-24T14:05:33Z",
    agentId: "eng-assistant-04",
    action: "code_analysis",
    outcome: "approved" as Outcome,
    receipt: "0x3b81…e004",
  },
  {
    id: "a3",
    time: "2026-04-23T09:11:00Z",
    agentId: "data-bot-02",
    action: "query_db",
    outcome: "approved" as Outcome,
    receipt: "0x9c12…aa77",
  },
] as const

export const POLICY_AGENTS = [
  {
    agentId: "eng-assistant-04",
    roleScope: "code_analysis_only",
    allowed: ["read_file", "code_analysis", "query_db"],
    denied: ["forum_post", "change_permissions"],
    dataSources: ["auth_module.py", "metrics_readonly"],
    consensus: "Unanimous",
  },
  {
    agentId: "data-bot-02",
    roleScope: "analytics_readonly",
    allowed: ["query_db", "read_file"],
    denied: ["change_permissions", "export_pii"],
    dataSources: ["user_metrics_table"],
    consensus: "Majority",
  },
] as const
