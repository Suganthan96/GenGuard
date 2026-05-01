export type EnterpriseChannel = "msteams" | "slack" | "mattermost" | "matrix" | "feishu"

export type ChannelContext = {
  channel: EnterpriseChannel
  userId?: string
  groupId?: string
  mentioned?: boolean
}

type ChannelPolicy = {
  enabled: boolean
  dmEnabled: boolean
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled"
  groupPolicy: "allowlist" | "open" | "disabled"
  requireMention: boolean
  allowFrom: string[]
  groupAllowFrom: string[]
  allowedUsers: string[]
  allowedGroups: string[]
}

type EnterpriseChannelPolicy = Record<EnterpriseChannel, ChannelPolicy>

export type ChannelGuardDecision = {
  ok: boolean
  reason?: string
  policy: ChannelPolicy
}

function parseList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x || "").trim()).filter(Boolean)
}

const DEFAULT_POLICY: EnterpriseChannelPolicy = {
  msteams: {
    enabled: true,
    dmEnabled: true,
    dmPolicy: "pairing",
    groupPolicy: "allowlist",
    requireMention: true,
    allowFrom: [],
    groupAllowFrom: [],
    allowedUsers: [],
    allowedGroups: [],
  },
  slack: {
    enabled: true,
    dmEnabled: true,
    dmPolicy: "pairing",
    groupPolicy: "allowlist",
    requireMention: true,
    allowFrom: [],
    groupAllowFrom: [],
    allowedUsers: [],
    allowedGroups: [],
  },
  mattermost: {
    enabled: true,
    dmEnabled: true,
    dmPolicy: "pairing",
    groupPolicy: "allowlist",
    requireMention: true,
    allowFrom: [],
    groupAllowFrom: [],
    allowedUsers: [],
    allowedGroups: [],
  },
  matrix: {
    enabled: true,
    dmEnabled: true,
    dmPolicy: "pairing",
    groupPolicy: "allowlist",
    requireMention: true,
    allowFrom: [],
    groupAllowFrom: [],
    allowedUsers: [],
    allowedGroups: [],
  },
  feishu: {
    enabled: true,
    dmEnabled: true,
    dmPolicy: "pairing",
    groupPolicy: "allowlist",
    requireMention: true,
    allowFrom: [],
    groupAllowFrom: [],
    allowedUsers: [],
    allowedGroups: [],
  },
}

function coercePolicy(raw: unknown): EnterpriseChannelPolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_POLICY
  const root = raw as Record<string, unknown>
  const out = { ...DEFAULT_POLICY }
  for (const key of Object.keys(DEFAULT_POLICY) as EnterpriseChannel[]) {
    const row = root[key]
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    out[key] = {
      enabled: r.enabled !== false,
      dmEnabled: r.dmEnabled !== false && (r.dm as Record<string, unknown> | undefined)?.enabled !== false,
      dmPolicy:
        r.dmPolicy === "allowlist" || r.dmPolicy === "open" || r.dmPolicy === "disabled"
          ? r.dmPolicy
          : (r.dm as Record<string, unknown> | undefined)?.policy === "allowlist" ||
              (r.dm as Record<string, unknown> | undefined)?.policy === "open" ||
              (r.dm as Record<string, unknown> | undefined)?.policy === "disabled"
            ? ((r.dm as Record<string, unknown>).policy as ChannelPolicy["dmPolicy"])
          : "pairing",
      groupPolicy: r.groupPolicy === "open" || r.groupPolicy === "disabled" ? r.groupPolicy : "allowlist",
      requireMention: r.requireMention !== false,
      allowFrom: parseList(r.allowFrom),
      groupAllowFrom: parseList(r.groupAllowFrom),
      allowedUsers: parseList(r.allowedUsers),
      allowedGroups: parseList(r.allowedGroups),
    }
  }
  return out
}

export function loadEnterpriseChannelPolicy(): EnterpriseChannelPolicy {
  const raw = process.env.OPENCLAW_ENTERPRISE_CHANNEL_POLICY_JSON?.trim()
  if (!raw) return DEFAULT_POLICY
  try {
    return coercePolicy(JSON.parse(raw) as unknown)
  } catch {
    return DEFAULT_POLICY
  }
}

function hasAny(list: string[]): boolean {
  return Array.isArray(list) && list.length > 0
}

function inAnyAllowlist(user: string, ...lists: string[][]): boolean {
  for (const list of lists) {
    if (!hasAny(list)) continue
    if (list.includes("*") || list.includes(user)) return true
  }
  return false
}

export function evaluateChannelGuard(ctx: ChannelContext): ChannelGuardDecision {
  const cfg = loadEnterpriseChannelPolicy()
  const policy = cfg[ctx.channel]

  if (!policy.enabled) {
    return { ok: false, reason: `Channel "${ctx.channel}" is disabled by enterprise policy`, policy }
  }

  const user = (ctx.userId || "").trim()
  const group = (ctx.groupId || "").trim()
  const isGroup = Boolean(group)

  if (isGroup) {
    if (policy.groupPolicy === "disabled") {
      return { ok: false, reason: `Group messages are disabled for "${ctx.channel}"`, policy }
    }
    if (policy.groupPolicy === "allowlist") {
      if (!group || !policy.allowedGroups.includes(group)) {
        return { ok: false, reason: `Group "${group || "(missing)"}" is not in allowlist for "${ctx.channel}"`, policy }
      }
    }
    if (policy.requireMention && !ctx.mentioned) {
      return { ok: false, reason: `Mention is required in group for "${ctx.channel}"`, policy }
    }
    if (hasAny(policy.allowedUsers) || hasAny(policy.groupAllowFrom) || hasAny(policy.allowFrom)) {
      const ok = user && inAnyAllowlist(user, policy.allowedUsers, policy.groupAllowFrom, policy.allowFrom)
      if (!ok) {
        return { ok: false, reason: `User "${user || "(missing)"}" is not allowed for "${ctx.channel}"`, policy }
      }
    }
    if (hasAny(policy.allowedGroups) && (!group || !policy.allowedGroups.includes(group))) {
      return { ok: false, reason: `Group "${group || "(missing)"}" is not allowed for "${ctx.channel}"`, policy }
    }
    if (hasAny(policy.groupAllowFrom) && !user) {
      return { ok: false, reason: `User "${user || "(missing)"}" is not allowed for "${ctx.channel}"`, policy }
    }
    return { ok: true, policy }
  }

  // DM
  if (!policy.dmEnabled) {
    return { ok: false, reason: `DM is disabled for "${ctx.channel}"`, policy }
  }
  if (policy.dmPolicy === "disabled") {
    return { ok: false, reason: `DMs are disabled for "${ctx.channel}"`, policy }
  }
  if (policy.dmPolicy === "allowlist" || policy.dmPolicy === "pairing") {
    // We model "pairing" conservatively on server side: enforce allowlist membership.
    const ok = user && inAnyAllowlist(user, policy.allowedUsers, policy.allowFrom)
    if (!ok) {
      return {
        ok: false,
        reason: `DM sender "${user || "(missing)"}" not approved for "${ctx.channel}" (${policy.dmPolicy})`,
        policy,
      }
    }
  }
  return { ok: true, policy }
}

export function channelPolicySummaryForPrompt(ctx: ChannelContext, decision: ChannelGuardDecision): string {
  return [
    "Enterprise channel guard context:",
    `channel=${ctx.channel}`,
    `user_id=${ctx.userId || "(none)"}`,
    `group_id=${ctx.groupId || "(dm)"}`,
    `mentioned=${ctx.mentioned ? "true" : "false"}`,
    `dm_policy=${decision.policy.dmPolicy}`,
    `group_policy=${decision.policy.groupPolicy}`,
    `require_mention=${decision.policy.requireMention ? "true" : "false"}`,
    `allowed_users_count=${decision.policy.allowedUsers.length}`,
    `allowed_groups_count=${decision.policy.allowedGroups.length}`,
  ].join("\n")
}
