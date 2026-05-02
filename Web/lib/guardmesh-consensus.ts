import type { VerdictRow } from "@/lib/axl-types"
import { OUTCOME, THRESHOLD } from "@/lib/contracts-config"

/** Aligns with `THRESHOLD` in contracts + explicit Phase-5 mesh table. */
export type ConsensusThresholdMode = "phase5" | "unanimous" | "majority" | "any"

export type FinalDecisionAction =
  | "execute"
  | "execute_contested"
  | "hold"
  | "block"
  | "insufficient_quorum"

export type GuardmeshFinalDecision = {
  /** Machine-readable outcome for wrappers (OpenClaw, CI, etc.). */
  action: FinalDecisionAction
  /** Single sentence the primary agent should treat as authoritative. */
  agentInstruction: string
}

export type ConsensusPhase5Outcome =
  | "approved_unanimous"
  | "approved_contested"
  | "hold_human_review"
  | "hard_stop_incident"
  | "insufficient_quorum"
  | "majority_execute_clean"
  | "majority_execute_contested"
  | "majority_hold"
  | "unanimous_required_fail"
  | "any_one_approve"
  | "any_one_approve_contested"

export type GuardmeshConsensus = {
  approveCount: number
  blockCount: number
  invalidCount: number
  totalVotes: number
  expectedGuardians: number
  /** Threshold applied to this computation. */
  threshold: ConsensusThresholdMode
  /** On-chain-style code for registry/audit alignment (1=ANY, 2=MAJORITY, 3=UNANIMOUS). */
  thresholdCode: number
  outcome: ConsensusPhase5Outcome
  execute: boolean
  contested: boolean
  requiresHumanReview: boolean
  raiseIncident: boolean
  rationale: string
  outcomeCode: number
  /** Primary-agent path: what to do next in one place. */
  finalDecision: GuardmeshFinalDecision
}

function classifyVote(verdict: string | undefined): "approve" | "block" | "invalid" {
  const v = (verdict || "").trim().toUpperCase()
  if (v === "APPROVE") return "approve"
  if (v === "BLOCK") return "block"
  return "invalid"
}

function thresholdCodeFor(mode: ConsensusThresholdMode): number {
  switch (mode) {
    case "any":
      return THRESHOLD.ANY
    case "majority":
      return THRESHOLD.MAJORITY
    case "unanimous":
      return THRESHOLD.UNANIMOUS
    default:
      return THRESHOLD.MAJORITY
  }
}

/**
 * Parse threshold from env or API body.
 * Accepts: `phase5`, `unanimous`, `majority`, `any` or numeric `1`/`2`/`3` (THRESHOLD codes).
 */
export function parseConsensusThreshold(raw: string | undefined | null): ConsensusThresholdMode {
  const t = String(raw ?? "phase5")
    .trim()
    .toLowerCase()
  if (t === "1" || t === "any" || t === "any_1") return "any"
  if (t === "2" || t === "majority" || t === "majority_2") return "majority"
  if (t === "3" || t === "unanimous" || t === "unanimous_3") return "unanimous"
  if (t === "phase5" || t === "mesh" || t === "default") return "phase5"
  return "phase5"
}

function buildFinalDecision(
  execute: boolean,
  contested: boolean,
  requiresHumanReview: boolean,
  raiseIncident: boolean,
  outcome: ConsensusPhase5Outcome,
  insufficient: boolean
): GuardmeshFinalDecision {
  if (insufficient || outcome === "insufficient_quorum") {
    return {
      action: "insufficient_quorum",
      agentInstruction:
        "Do not run the guarded action. Guardian quorum was not reached in time — retry with a longer timeout or verify AXL listeners, then ask a human if it persists.",
    }
  }
  if (raiseIncident && !execute) {
    return {
      action: "block",
      agentInstruction:
        "Do not run the guarded action. All guardians blocked or a hard-stop incident was raised — stop and escalate to a human operator.",
    }
  }
  if (execute && contested) {
    return {
      action: "execute_contested",
      agentInstruction:
        "You may proceed with the guarded action, but consensus was contested — log the dissent, apply extra caution, and avoid expanding scope beyond the approved intent.",
    }
  }
  if (execute) {
    return {
      action: "execute",
      agentInstruction: "Consensus allows this action. Proceed with the planned tool or side effect, staying within the approved intent.",
    }
  }
  if (requiresHumanReview) {
    return {
      action: "hold",
      agentInstruction:
        "Do not run the guarded action without a human decision. Mesh outcome requires manual review (hold / unclear / policy).",
    }
  }
  return {
    action: "block",
    agentInstruction: "Do not run the guarded action. Mesh outcome is blocked.",
  }
}

function strictMajorityApprove(n: number): number {
  return Math.ceil((n + 1) / 2)
}

function minimumVotesRequired(mode: ConsensusThresholdMode, expectedGuardians: number): number {
  switch (mode) {
    case "any":
      return 1
    case "majority":
      return strictMajorityApprove(expectedGuardians)
    case "unanimous":
    case "phase5":
    default:
      return expectedGuardians
  }
}

type VoteCounts = {
  approveCount: number
  blockCount: number
  invalidCount: number
  totalVotes: number
  expectedGuardians: number
}

function consensusPhase5Table(counts: VoteCounts): GuardmeshConsensus | null {
  const { approveCount, blockCount, invalidCount, totalVotes, expectedGuardians: n } = counts
  if (invalidCount > 0 || totalVotes < n) return null
  if (n !== 3 || totalVotes !== 3) return null

  const threshold: ConsensusThresholdMode = "phase5"
  const thresholdCode = thresholdCodeFor(threshold)
  const base = { ...counts, threshold, thresholdCode }

  if (approveCount === 3) {
    return {
      ...base,
      outcome: "approved_unanimous",
      execute: true,
      contested: false,
      requiresHumanReview: false,
      raiseIncident: false,
      rationale: "All 3 guardians APPROVE — execute action (phase5 table).",
      outcomeCode: OUTCOME.APPROVED,
      finalDecision: buildFinalDecision(true, false, false, false, "approved_unanimous", false),
    }
  }
  if (approveCount === 2 && blockCount === 1) {
    return {
      ...base,
      outcome: "approved_contested",
      execute: true,
      contested: true,
      requiresHumanReview: false,
      raiseIncident: false,
      rationale: "2 APPROVE, 1 BLOCK — execute but flag as contested (phase5 table).",
      outcomeCode: OUTCOME.CONTESTED,
      finalDecision: buildFinalDecision(true, true, false, false, "approved_contested", false),
    }
  }
  if (approveCount === 1 && blockCount === 2) {
    return {
      ...base,
      outcome: "hold_human_review",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: false,
      rationale: "2 BLOCK vs 1 APPROVE — hold for human review (phase5 table).",
      outcomeCode: OUTCOME.PENDING,
      finalDecision: buildFinalDecision(false, false, true, false, "hold_human_review", false),
    }
  }
  if (blockCount === 3) {
    return {
      ...base,
      outcome: "hard_stop_incident",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: true,
      rationale: "All 3 guardians BLOCK — hard stop; raise incident (phase5 table).",
      outcomeCode: OUTCOME.BLOCKED,
      finalDecision: buildFinalDecision(false, false, true, true, "hard_stop_incident", false),
    }
  }
  return null
}

function consensusSupermajorFallback(counts: VoteCounts, threshold: ConsensusThresholdMode): GuardmeshConsensus {
  const { approveCount, blockCount, totalVotes, expectedGuardians: n } = counts
  const thresholdCode = thresholdCodeFor(threshold)
  const base = { ...counts, threshold, thresholdCode }
  const supermajor = Math.ceil((2 * totalVotes) / 3)
  if (approveCount >= supermajor && approveCount > blockCount) {
    const contested = blockCount > 0 || approveCount < totalVotes
    return {
      ...base,
      outcome: contested ? "majority_execute_contested" : "majority_execute_clean",
      execute: true,
      contested,
      requiresHumanReview: false,
      raiseIncident: false,
      rationale: `Supermajority APPROVE (${approveCount}/${totalVotes}) — execute${contested ? " (contested)" : ""}.`,
      outcomeCode: contested ? OUTCOME.CONTESTED : OUTCOME.APPROVED,
      finalDecision: buildFinalDecision(true, contested, false, false, contested ? "majority_execute_contested" : "majority_execute_clean", false),
    }
  }
  if (blockCount >= supermajor && blockCount > approveCount) {
    const allBlock = blockCount === totalVotes
    return {
      ...base,
      outcome: allBlock && totalVotes >= n ? "hard_stop_incident" : "majority_hold",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: allBlock && totalVotes >= n,
      rationale: allBlock
        ? "All guardians BLOCK — hard stop; raise incident."
        : `Majority BLOCK (${blockCount}/${totalVotes}) — hold for human review.`,
      outcomeCode: allBlock && totalVotes >= n ? OUTCOME.BLOCKED : OUTCOME.PENDING,
      finalDecision: buildFinalDecision(
        false,
        false,
        true,
        allBlock && totalVotes >= n,
        allBlock && totalVotes >= n ? "hard_stop_incident" : "majority_hold",
        false
      ),
    }
  }
  return {
    ...base,
    outcome: "hold_human_review",
    execute: false,
    contested: false,
    requiresHumanReview: true,
    raiseIncident: false,
    rationale: "No clear supermajority — hold for human review.",
    outcomeCode: OUTCOME.PENDING,
    finalDecision: buildFinalDecision(false, false, true, false, "hold_human_review", false),
  }
}

function consensusByThreshold(counts: VoteCounts, mode: ConsensusThresholdMode): GuardmeshConsensus {
  const { approveCount, blockCount, invalidCount, totalVotes, expectedGuardians: n } = counts
  const thresholdCode = thresholdCodeFor(mode)
  const base = { ...counts, threshold: mode, thresholdCode }

  if (invalidCount > 0) {
    return {
      ...base,
      outcome: "hold_human_review",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: false,
      rationale: `${invalidCount} verdict(s) were not APPROVE/BLOCK — hold for review.`,
      outcomeCode: OUTCOME.PENDING,
      finalDecision: buildFinalDecision(false, false, true, false, "hold_human_review", false),
    }
  }

  const quorum = minimumVotesRequired(mode, n)
  if (totalVotes < quorum) {
    return {
      ...base,
      outcome: "insufficient_quorum",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: false,
      rationale: `Received ${totalVotes}/${quorum} required guardian verdicts before timeout — hold.`,
      outcomeCode: OUTCOME.PENDING,
      finalDecision: buildFinalDecision(false, false, true, false, "insufficient_quorum", true),
    }
  }

  if (mode === "phase5") {
    const p5 = consensusPhase5Table(counts)
    if (p5) return p5
    return consensusSupermajorFallback(counts, "phase5")
  }

  if (mode === "unanimous") {
    if (approveCount === n && blockCount === 0) {
      return {
        ...base,
        outcome: "approved_unanimous",
        execute: true,
        contested: false,
        requiresHumanReview: false,
        raiseIncident: false,
        rationale: "Unanimous threshold: all guardians APPROVE.",
        outcomeCode: OUTCOME.APPROVED,
        finalDecision: buildFinalDecision(true, false, false, false, "approved_unanimous", false),
      }
    }
    if (blockCount === n) {
      return {
        ...base,
        outcome: "hard_stop_incident",
        execute: false,
        contested: false,
        requiresHumanReview: true,
        raiseIncident: true,
        rationale: "Unanimous threshold: all guardians BLOCK.",
        outcomeCode: OUTCOME.BLOCKED,
        finalDecision: buildFinalDecision(false, false, true, true, "hard_stop_incident", false),
      }
    }
    return {
      ...base,
      outcome: "unanimous_required_fail",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: false,
      rationale: "Unanimous threshold: mixed votes — no execution without all APPROVE.",
      outcomeCode: OUTCOME.PENDING,
      finalDecision: buildFinalDecision(false, false, true, false, "unanimous_required_fail", false),
    }
  }

  if (mode === "majority") {
    const need = strictMajorityApprove(n)
    if (approveCount >= need && approveCount > blockCount) {
      const contested = blockCount > 0
      return {
        ...base,
        outcome: contested ? "majority_execute_contested" : "majority_execute_clean",
        execute: true,
        contested,
        requiresHumanReview: false,
        raiseIncident: false,
        rationale: `Majority threshold: ${approveCount}/${n} APPROVE (need ≥${need})${contested ? " — contested" : ""}.`,
        outcomeCode: contested ? OUTCOME.CONTESTED : OUTCOME.APPROVED,
        finalDecision: buildFinalDecision(true, contested, false, false, contested ? "majority_execute_contested" : "majority_execute_clean", false),
      }
    }
    if (blockCount >= need && blockCount > approveCount) {
      const allBlock = blockCount === n
      return {
        ...base,
        outcome: allBlock ? "hard_stop_incident" : "majority_hold",
        execute: false,
        contested: false,
        requiresHumanReview: true,
        raiseIncident: allBlock,
        rationale: allBlock
          ? "Majority threshold: blocking side wins; all BLOCK."
          : `Majority threshold: blocking side leads (${blockCount} BLOCK) — hold.`,
        outcomeCode: allBlock ? OUTCOME.BLOCKED : OUTCOME.PENDING,
        finalDecision: buildFinalDecision(false, false, true, allBlock, allBlock ? "hard_stop_incident" : "majority_hold", false),
      }
    }
    return {
      ...base,
      outcome: "hold_human_review",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: false,
      rationale: "Majority threshold: tie or unclear split — hold for human review.",
      outcomeCode: OUTCOME.PENDING,
      finalDecision: buildFinalDecision(false, false, true, false, "hold_human_review", false),
    }
  }

  // mode === "any"
  if (blockCount === n && approveCount === 0) {
    return {
      ...base,
      outcome: "hard_stop_incident",
      execute: false,
      contested: false,
      requiresHumanReview: true,
      raiseIncident: true,
      rationale: "Any-1 threshold: no APPROVE — all BLOCK.",
      outcomeCode: OUTCOME.BLOCKED,
      finalDecision: buildFinalDecision(false, false, true, true, "hard_stop_incident", false),
    }
  }
  if (approveCount >= 1) {
    const contested = blockCount > 0
    return {
      ...base,
      outcome: contested ? "any_one_approve_contested" : "any_one_approve",
      execute: true,
      contested,
      requiresHumanReview: false,
      raiseIncident: false,
      rationale: `Any-1 threshold: at least one APPROVE (${approveCount})${contested ? " with dissent" : ""}.`,
      outcomeCode: contested ? OUTCOME.CONTESTED : OUTCOME.APPROVED,
      finalDecision: buildFinalDecision(true, contested, false, false, contested ? "any_one_approve_contested" : "any_one_approve", false),
    }
  }
  return {
    ...base,
    outcome: "hold_human_review",
    execute: false,
    contested: false,
    requiresHumanReview: true,
    raiseIncident: false,
    rationale: "Any-1 threshold: no APPROVE votes — hold.",
    outcomeCode: OUTCOME.PENDING,
    finalDecision: buildFinalDecision(false, false, true, false, "hold_human_review", false),
  }
}

export type ComputeConsensusOptions = {
  threshold?: ConsensusThresholdMode
}

/**
 * Mesh consensus over guardian verdicts.
 *
 * **phase5** (default): for exactly 3 guardians and 3 votes, uses the checklist table;
 * otherwise supermajority-style fallback.
 *
 * **unanimous**: all `n` votes must be APPROVE to execute; any mixed or all-BLOCK → hold / incident.
 *
 * **majority**: need strict majority APPROVE (`ceil((n+1)/2)`) over full quorum `n`.
 *
 * **any**: at least one APPROVE with not all BLOCK → execute (contested if any BLOCK); all BLOCK → incident.
 */
export function computeGuardmeshConsensus(
  verdicts: VerdictRow[],
  expectedGuardians: number,
  options?: ComputeConsensusOptions
): GuardmeshConsensus {
  let approveCount = 0
  let blockCount = 0
  let invalidCount = 0
  for (const row of verdicts) {
    const c = classifyVote(row.verdict)
    if (c === "approve") approveCount++
    else if (c === "block") blockCount++
    else invalidCount++
  }

  const totalVotes = verdicts.length
  const n = expectedGuardians
  const threshold = options?.threshold ?? "phase5"

  const counts: VoteCounts = {
    approveCount,
    blockCount,
    invalidCount,
    totalVotes,
    expectedGuardians: n,
  }

  return consensusByThreshold(counts, threshold)
}
