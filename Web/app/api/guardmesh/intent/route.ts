import { NextResponse } from "next/server"
import type { GuardmeshIntent } from "@/lib/guardmesh-intent"
import {
  broadcastIntent,
  getAxlHubUrl,
  pollVerdicts,
  resolveGuardianPeerIds,
} from "@/lib/axl-intent-bridge"
import { computeGuardmeshConsensus, parseConsensusThreshold } from "@/lib/guardmesh-consensus"
import { runGuardmeshPhase6Anchor } from "@/lib/guardmesh-phase6-anchor"

export const runtime = "nodejs"

type Body = {
  intent?: GuardmeshIntent
  /** Optional: `phase5` | `unanimous` | `majority` | `any` or `1`/`2`/`3` (THRESHOLD codes). */
  consensus_threshold?: string
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rawIntent = body.intent
  if (!rawIntent || typeof rawIntent !== "object") {
    return NextResponse.json({ error: "intent object is required" }, { status: 400 })
  }

  const envAgent = process.env.GUARDMESH_DEFAULT_AGENT_ID?.trim()
  const envRole = process.env.GUARDMESH_DEFAULT_ROLE_SCOPE?.trim()

  const intent: GuardmeshIntent = {
    agent_id: (rawIntent.agent_id?.trim() || envAgent || "").trim(),
    action_type: rawIntent.action_type?.trim() || "code_analysis",
    target: rawIntent.target?.trim() || "workspace",
    content: typeof rawIntent.content === "string" ? rawIntent.content : "",
    data_touched: Array.isArray(rawIntent.data_touched) ? rawIntent.data_touched : [],
    role_scope: (rawIntent.role_scope?.trim() || envRole || "").trim(),
    analysis_excerpt: rawIntent.analysis_excerpt,
    openclaw_stats: rawIntent.openclaw_stats,
  }

  if (!intent.agent_id) {
    return NextResponse.json(
      {
        error:
          "intent.agent_id is empty and GUARDMESH_DEFAULT_AGENT_ID is not set. Register an agent in Policies, then set GUARDMESH_DEFAULT_AGENT_ID (e.g. suguagent.eth) on the Web server.",
      },
      { status: 400 }
    )
  }

  const timeoutMs = Math.min(
    Math.max(Number(process.env.GUARDMESH_INTENT_TIMEOUT_MS) || 25000, 3000),
    120000
  )
  const phase6TimeoutMs = Math.min(
    Math.max(Number(process.env.GUARDMESH_PHASE6_TIMEOUT_MS) || 12000, 2000),
    60000
  )

  try {
    const axlUrl = getAxlHubUrl()
    const peerIds = await resolveGuardianPeerIds(axlUrl)
    const sendResults = await broadcastIntent(axlUrl, peerIds, intent)
    const okPeers = sendResults.filter((r) => r.ok).length
    if (okPeers === 0) {
      return NextResponse.json(
        { error: "AXL send failed for all peers", sendResults },
        { status: 502 }
      )
    }
    const verdicts = await pollVerdicts(axlUrl, okPeers, timeoutMs)
    const threshold = parseConsensusThreshold(
      body.consensus_threshold ?? process.env.GUARDMESH_CONSENSUS_THRESHOLD
    )
    const consensus = computeGuardmeshConsensus(verdicts, peerIds.length, { threshold })

    /** Never let Phase 6 (0G upload / recordDecision) block the primary response for too long. */
    let phase6_audit: Awaited<ReturnType<typeof runGuardmeshPhase6Anchor>>
    try {
      phase6_audit = (await Promise.race([
        runGuardmeshPhase6Anchor({
          intent,
          verdicts,
          consensus,
          sendResults,
        }),
        new Promise<Awaited<ReturnType<typeof runGuardmeshPhase6Anchor>>>((resolve) =>
          setTimeout(
            () =>
              resolve({
                enabled: true,
                ok: false,
                stage: "unexpected",
                message: `Phase 6 timed out after ${phase6TimeoutMs}ms; consensus returned without blocking UI.`,
              }),
            phase6TimeoutMs
          )
        ),
      ])) as Awaited<ReturnType<typeof runGuardmeshPhase6Anchor>>
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      phase6_audit = {
        enabled: true,
        ok: false,
        stage: "unexpected",
        message: `Phase 6 threw (this should be rare): ${message}`,
      }
    }

    return NextResponse.json({
      axlUrl,
      peerCount: peerIds.length,
      consensus_threshold: threshold,
      /** Effective intent after server env defaults (`GUARDMESH_DEFAULT_*`). */
      intent_effective: {
        agent_id: intent.agent_id,
        role_scope: intent.role_scope,
        action_type: intent.action_type,
      },
      sendResults,
      verdicts,
      partial: verdicts.length < peerIds.length,
      consensus,
      /** 0G Storage upload + `GuardMeshAudit.recordDecision` when `GUARDMESH_PHASE6_ANCHOR=1`. */
      phase6_audit,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
