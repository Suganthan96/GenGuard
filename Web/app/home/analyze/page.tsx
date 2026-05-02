"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useWallet } from "@/contexts/wallet-context"
import { useGuardmeshContracts } from "@/hooks/use-guardmesh-contracts"
import type { RegistryPolicy } from "@/lib/guardmesh-contracts"
import { loadGuardmeshLocalToolPrefs } from "@/lib/guardmesh-local-prefs"
import { formatContractError } from "@/lib/tx-utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const GATE_ACTIONS = ["code_analysis", "query_db", "read_file"] as const
type GateAction = (typeof GATE_ACTIONS)[number]
const ENTERPRISE_CHANNELS = ["msteams", "slack", "mattermost", "matrix", "feishu"] as const
type EnterpriseChannel = (typeof ENTERPRISE_CHANNELS)[number]

type ChatMsg = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  at: number
}

function allowedGateKinds(p: RegistryPolicy | null): GateAction[] {
  if (!p?.active) return []
  const set = new Set(p.allowedActions.map((a) => a.trim().toLowerCase()))
  return GATE_ACTIONS.filter((a) => set.has(a))
}

type IntentResponse = {
  error?: string
  phase6_audit?: {
    enabled?: boolean
    ok?: boolean
    merkleRoot?: string
  }
  consensus?: {
    execute?: boolean
    outcome?: string
    rationale?: string
    finalDecision?: { action?: string; agentInstruction?: string }
  }
  verdicts?: unknown[]
  intent_effective?: { agent_id?: string; action_type?: string; role_scope?: string }
}

type BundleRetrieveResponse = {
  ok?: boolean
  bundle?: {
    policySnapshot?: {
      agentId: string
      roleScope: string
      allowedActions: string[]
      deniedActions: string[]
      allowedDataSources: string[]
      consensusThreshold: number
      active: boolean
      source: string
    }
  }
}

type OpenclawReplyResponse = {
  ok?: boolean
  text?: string
  error?: string
}

function meshAllowsExecute(data: IntentResponse): boolean {
  if (data.consensus?.execute === true) return true
  const a = data.consensus?.finalDecision?.action
  return a === "execute" || a === "execute_contested"
}

function toolAuthHeaders(): HeadersInit {
  const { toolSecret } = loadGuardmeshLocalToolPrefs()
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (toolSecret.trim()) h.Authorization = `Bearer ${toolSecret.trim()}`
  return h
}

function msgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function summarizeDbResult(runJson: Record<string, unknown>, op: "listCollections" | "sample") {
  const result =
    runJson && typeof runJson.result === "object" && runJson.result !== null
      ? (runJson.result as Record<string, unknown>)
      : null
  if (!result) return "DB read completed."

  const dbName = typeof result.dbName === "string" ? result.dbName : ""
  const host = typeof result.host === "string" ? result.host : ""

  if (op === "listCollections") {
    const count = Number(result.count ?? 0)
    const names = Array.isArray(result.names) ? (result.names as unknown[]).map(String) : []
    if (count > 0) {
      return `Found ${count} collections in \`${dbName || "(default db)"}\` on \`${host || "mongo host"}\`: ${names.join(", ")}`
    }
    return [
      `Connected to \`${dbName || "(default db)"}\` on \`${host || "mongo host"}\` but found no collections.`,
      "This usually means the URI database name is different from where your data exists.",
      "Try the DB name exactly as shown in Compass (for your screenshot, likely `test` or `kite garden` instead of `kite-garden`).",
    ].join("\n")
  }

  const count = Number(result.count ?? 0)
  const coll = typeof result.collection === "string" ? result.collection : "collection"
  return `Sampled ${count} document(s) from \`${dbName || "(default db)"}.${coll}\` on \`${host || "mongo host"}\`.`
}

export default function AgentAnalyzePage() {
  const { address, is0gNetwork } = useWallet()
  const { registryRead } = useGuardmeshContracts()
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [policies, setPolicies] = useState<RegistryPolicy[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>("")

  const [workKind, setWorkKind] = useState<GateAction>("code_analysis")
  const [workDescription, setWorkDescription] = useState("")
  const [workspacePath, setWorkspacePath] = useState("")
  const [dbOp, setDbOp] = useState<"listCollections" | "sample">("listCollections")
  const [dbCollection, setDbCollection] = useState("")
  const [dbUri, setDbUri] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<EnterpriseChannel>("msteams")
  const [channelUserId, setChannelUserId] = useState("")
  const [channelGroupId, setChannelGroupId] = useState("")
  const [channelMentioned, setChannelMentioned] = useState(true)
  const [gatedRunning, setGatedRunning] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])

  const selected = policies.find((p) => p.agentId === selectedId) ?? null
  const gateKinds = useMemo(() => allowedGateKinds(selected), [selected])

  const pushChat = useCallback((role: ChatMsg["role"], content: string) => {
    setChatMessages((m) => [...m, { id: msgId(), role, content, at: Date.now() }])
  }, [])

  useEffect(() => {
    const prefs = loadGuardmeshLocalToolPrefs()
    setDbUri(prefs.mongodbUri || "")
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  useEffect(() => {
    const first = gateKinds[0]
    if (first) setWorkKind(first)
  }, [selectedId, gateKinds])

  useEffect(() => {
    if (!selected?.active || !selectedId) return
    setChatMessages([
      {
        id: msgId(),
        role: "system",
        content: `Agent **${selected.agentId}** — messages are sent through GuardMesh (intent → consensus) before tools run. Ensure AXL + guardians are up.`,
        at: Date.now(),
      },
    ])
  }, [selectedId, selected?.active, selected?.agentId])

  const loadPolicies = useCallback(async () => {
    if (!address) {
      setPolicies([])
      return
    }
    setLoadErr(null)
    try {
      const ids: string[] = await registryRead.getOwnerAgents(address)
      const list: RegistryPolicy[] = []
      for (const id of ids) {
        try {
          const p = await registryRead.getPolicy(id)
          list.push(p as unknown as RegistryPolicy)
        } catch {
          /* skip */
        }
      }
      setPolicies(list)
      setSelectedId((prev) => {
        if (list.length === 0) return ""
        if (list.some((p) => p.agentId === prev)) return prev
        return list[0].agentId
      })
    } catch (e) {
      setLoadErr(formatContractError(e))
    }
  }, [address, registryRead])

  useEffect(() => {
    void loadPolicies()
  }, [loadPolicies])

  useEffect(() => {
    setWorkDescription("")
    setWorkspacePath("")
  }, [selectedId])

  const executeGatedTurn = async (desc: string) => {
    if (!selected?.active) {
      toast.error("Agent must be active on-chain.")
      return
    }
    if (!gateKinds.includes(workKind)) {
      toast.error("Action not allowed for this agent.")
      return
    }
    if (workKind === "read_file") {
      const p = workspacePath.trim()
      if (!p) {
        toast.error("Workspace path is required for read file.")
        return
      }
    }
    if (workKind === "query_db" && dbOp === "sample" && !dbCollection.trim()) {
      toast.error("Collection name is required for sample.")
      return
    }
    if (workKind === "query_db" && !dbUri.trim()) {
      toast.error("MongoDB URI is required for DB read.")
      return
    }

    const target =
      workKind === "read_file"
        ? workspacePath.trim() || "workspace"
        : workKind === "query_db"
          ? "mongodb"
          : "workspace"
    const dataTouched =
      workKind === "read_file" && workspacePath.trim()
        ? [workspacePath.trim()]
        : workKind === "query_db"
          ? ["mongodb"]
          : []

    const intentBody = {
      intent: {
        agent_id: selected.agentId,
        action_type: workKind,
        target,
        content: desc.slice(0, 8000),
        data_touched: dataTouched,
        role_scope: selected.roleScope,
      },
    }

    setGatedRunning(true)

    try {
      const maybeOpenclawReply = async (toolResult: unknown) => {
        try {
          const ocRes = await fetch("/api/guardmesh/run/openclaw-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: workKind,
              userMessage: desc,
              toolResult,
              channelContext: {
                channel: selectedChannel,
                userId: channelUserId.trim() || undefined,
                groupId: channelGroupId.trim() || undefined,
                mentioned: channelMentioned,
              },
            }),
            signal: AbortSignal.timeout(90_000),
          })
          const ocJson = (await ocRes.json().catch(() => ({}))) as OpenclawReplyResponse
          if (ocRes.ok && ocJson.ok && ocJson.text?.trim()) {
            pushChat("assistant", ocJson.text.trim())
            return true
          }
          return false
        } catch {
          return false
        }
      }

      toast.message("GuardMesh: intent → guardians…")
      const intentRes = await fetch("/api/guardmesh/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intentBody),
        signal: AbortSignal.timeout(90_000),
      })
      const intentText = await intentRes.text()
      let intentJson: IntentResponse
      try {
        intentJson = JSON.parse(intentText) as IntentResponse
      } catch {
        intentJson = { error: intentText.slice(0, 500) }
      }

      console.info("[Agent chat] intent", intentJson)

      if (!intentRes.ok) {
        pushChat("assistant", `Intent failed: ${intentJson.error || intentRes.status}\n\n\`\`\`json\n${JSON.stringify(intentJson, null, 2).slice(0, 6000)}\n\`\`\``)
        toast.error(intentJson.error || `HTTP ${intentRes.status}`)
        return
      }

      if (!meshAllowsExecute(intentJson)) {
        const why =
          intentJson.consensus?.finalDecision?.agentInstruction ||
          intentJson.consensus?.rationale ||
          "Mesh did not approve execution."
        pushChat(
          "assistant",
          `**Not executed** — ${why}\n\n\`\`\`json\n${JSON.stringify({ consensus: intentJson.consensus, verdicts: intentJson.verdicts }, null, 2).slice(0, 8000)}\n\`\`\``
        )
        toast.error("GuardMesh did not approve this request.")
        return
      }

      toast.success("Approved — running tool…")
      pushChat("assistant", "*GuardMesh approved. Running server tool…*")

      // Show real scope data from 0G retrieval for this decision when available.
      const merkleRoot = intentJson.phase6_audit?.ok ? intentJson.phase6_audit.merkleRoot : undefined
      if (merkleRoot) {
        try {
          const rbRes = await fetch(
            `/api/guardmesh/retrieve-bundle?merkleRoot=${encodeURIComponent(merkleRoot)}`,
            { method: "GET", signal: AbortSignal.timeout(60_000) }
          )
          const rbJson = (await rbRes.json().catch(() => ({}))) as BundleRetrieveResponse
          if (rbRes.ok && rbJson.ok && rbJson.bundle?.policySnapshot) {
            const p = rbJson.bundle.policySnapshot
            pushChat(
              "assistant",
              [
                "**Policy scope (from 0G Storage bundle):**",
                `agent_id=${p.agentId}`,
                `role_scope=${p.roleScope}`,
                `allowed_actions=${(p.allowedActions || []).join(", ") || "(none)"}`,
                `denied_actions=${(p.deniedActions || []).join(", ") || "(none)"}`,
                `allowed_data_sources=${(p.allowedDataSources || []).join(", ") || "(none)"}`,
                `consensus_threshold=${p.consensusThreshold}`,
                `active=${p.active}`,
                `source=${p.source}`,
                `merkle_root=${merkleRoot}`,
              ].join("\n")
            )
          }
        } catch {
          // Keep analysis flow uninterrupted if retrieval is temporarily unavailable.
        }
      }

      const headers = toolAuthHeaders()

      if (workKind === "code_analysis") {
        const codeBlock = `// Request (no separate code block)\n${desc.slice(0, 120_000)}`
        const paths = workspacePath.trim() ? [workspacePath.trim()] : undefined
        const runRes = await fetch("/api/guardmesh/run/code-analysis", {
          method: "POST",
          headers,
          body: JSON.stringify({
            policy: {
              agentId: selected.agentId,
              roleScope: selected.roleScope,
              allowedActions: selected.allowedActions,
            },
            code: codeBlock,
            question: desc,
            paths: paths && paths.length ? paths : undefined,
            persistForDashboard: true,
          }),
          signal: AbortSignal.timeout(120_000),
        })
        const runText = await runRes.text()
        let runJson: { error?: string; analysis?: string; model?: string }
        try {
          runJson = JSON.parse(runText) as typeof runJson
        } catch {
          runJson = { error: runText.slice(0, 400) }
        }
        console.info("[Agent chat] code-analysis", runJson)
        if (!runRes.ok) {
          pushChat("assistant", `Code analysis error: ${runJson.error || runRes.status}`)
          toast.error(runJson.error || "code-analysis failed")
          return
        }
        const usedOpenclaw = await maybeOpenclawReply(runJson)
        if (!usedOpenclaw) {
          const body =
            (runJson.analysis || "").trim() ||
            `_(${runJson.model || "model"} — empty body)_\n\n\`\`\`json\n${JSON.stringify(runJson, null, 2)}\n\`\`\``
          pushChat("assistant", body)
        }
        toast.success("Done.")
      } else if (workKind === "read_file") {
        const runRes = await fetch("/api/guardmesh/run/read-file", {
          method: "POST",
          headers,
          body: JSON.stringify({ path: workspacePath.trim() }),
          signal: AbortSignal.timeout(60_000),
        })
        const runJson = (await runRes.json().catch(() => ({}))) as Record<string, unknown>
        console.info("[Agent chat] read-file", runJson)
        if (!runRes.ok) {
          pushChat("assistant", `Read file error: ${String(runJson.error || runRes.status)}`)
          toast.error(String(runJson.error || runRes.status))
          return
        }
        const usedOpenclaw = await maybeOpenclawReply(runJson)
        if (!usedOpenclaw) {
          pushChat("assistant", `\`\`\`json\n${JSON.stringify(runJson, null, 2).slice(0, 12000)}\n\`\`\``)
        }
        toast.success("Done.")
      } else if (workKind === "query_db") {
        const body =
          dbOp === "listCollections"
            ? { operation: "listCollections" as const, mongodbUri: dbUri.trim() }
            : {
                operation: "sample" as const,
                collection: dbCollection.trim(),
                limit: 20,
                mongodbUri: dbUri.trim(),
              }
        const runRes = await fetch("/api/guardmesh/run/query-db", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        })
        const runJson = (await runRes.json().catch(() => ({}))) as Record<string, unknown>
        console.info("[Agent chat] query-db", runJson)
        if (!runRes.ok) {
          pushChat("assistant", `DB error: ${String(runJson.error || runRes.status)}`)
          toast.error(String(runJson.error || runRes.status))
          return
        }
        const usedOpenclaw = await maybeOpenclawReply(runJson)
        if (!usedOpenclaw) {
          pushChat("assistant", summarizeDbResult(runJson, dbOp))
          pushChat("assistant", `\`\`\`json\n${JSON.stringify(runJson, null, 2).slice(0, 12000)}\n\`\`\``)
        }
        toast.success("Done.")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[Agent chat] error", e)
      pushChat("assistant", `**Error:** ${msg}`)
      toast.error(msg)
    } finally {
      setGatedRunning(false)
    }
  }

  const sendMessage = () => {
    const desc = workDescription.trim()
    if (!desc) {
      toast.error("Type a message first.")
      return
    }
    pushChat("user", desc)
    setWorkDescription("")
    void executeGatedTurn(desc)
  }

  const canChat = !!(address && is0gNetwork && selected?.active && gateKinds.length > 0)

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto h-[calc(100dvh-7.25rem)] min-h-[420px] md:h-[calc(100dvh-8.5rem)]">
      <div className="shrink-0 flex flex-wrap items-end gap-3 pb-3 border-b border-black/[0.08]">
        <div className="flex-1 min-w-[140px] space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-black/35">Agent</Label>
          {!address ? (
            <p className="text-xs text-amber-900/90">
              <Link href="/" className="underline">
                Connect wallet
              </Link>
            </p>
          ) : !is0gNetwork ? (
            <p className="text-xs text-amber-900/90">Switch to 0G Galileo (16602).</p>
          ) : policies.length === 0 ? (
            <p className="text-xs text-black/45">
              No agents —{" "}
              <Link href="/home/policies" className="underline">
                Policy editor
              </Link>
            </p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                {policies.map((p) => (
                  <SelectItem key={p.agentId} value={p.agentId}>
                    {p.agentId}
                    {!p.active ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="w-[min(100%,200px)] space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-black/35">Action</Label>
          <Select value={workKind} onValueChange={(v) => setWorkKind(v as GateAction)} disabled={!selected?.active}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gateKinds.includes("code_analysis") ? (
                <SelectItem value="code_analysis">Code analysis</SelectItem>
              ) : null}
              {gateKinds.includes("query_db") ? (
                <SelectItem value="query_db">DB read</SelectItem>
              ) : null}
              {gateKinds.includes("read_file") ? (
                <SelectItem value="read_file">Read file / dir</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[min(100%,180px)] space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-black/35">Channel</Label>
          <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as EnterpriseChannel)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="msteams">MS Teams</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="mattermost">Mattermost</SelectItem>
              <SelectItem value="matrix">Matrix</SelectItem>
              <SelectItem value="feishu">Feishu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Link
          href="/home/policies"
          className="text-[11px] text-black/40 hover:text-black underline underline-offset-2 pb-1"
        >
          Policies
        </Link>
      </div>

      {loadErr ? <p className="text-xs text-red-700 shrink-0 py-1">{loadErr}</p> : null}

      {selected && !selected.active ? (
        <p className="text-xs text-amber-900/90 shrink-0 py-1">
          Activate <span className="font-mono">{selected.agentId}</span> in Policies.
        </p>
      ) : null}

      {selected && selected.active && gateKinds.length === 0 ? (
        <p className="text-xs text-amber-900/90 shrink-0 py-1">
          Add <span className="font-mono">code_analysis</span>, <span className="font-mono">query_db</span>, or{" "}
          <span className="font-mono">read_file</span> to allowed actions.
        </p>
      ) : null}

      {/* Chat thread */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-black/[0.07] bg-white/70 px-3 py-4 md:px-5 my-3 space-y-4">
        {chatMessages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-8 md:ml-16 rounded-2xl rounded-br-md bg-black/[0.06] px-4 py-3 text-sm text-black/90"
                : m.role === "system"
                  ? "mx-auto max-w-[95%] text-center text-[11px] text-black/40 px-2"
                  : "mr-8 md:mr-12 rounded-2xl rounded-bl-md border border-black/[0.06] bg-white px-4 py-3 text-sm text-black/85"
            }
          >
            {m.role === "assistant" || m.role === "system" ? (
              <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:text-[11px] prose-pre:bg-black/[0.04] prose-pre:border prose-pre:border-black/10">
                {/* simple markdown-ish: ** and ``` split */}
                <AssistantBubble text={m.content} />
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 flex flex-col gap-2 rounded-2xl border border-black/[0.1] bg-white p-3 shadow-sm max-h-[22vh]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            value={channelUserId}
            onChange={(e) => setChannelUserId(e.target.value)}
            placeholder="Channel user ID (optional)"
            className="font-mono text-xs h-9"
          />
          <Input
            value={channelGroupId}
            onChange={(e) => setChannelGroupId(e.target.value)}
            placeholder="Group/room ID (optional for DM)"
            className="font-mono text-xs h-9"
          />
          <button
            type="button"
            onClick={() => setChannelMentioned((v) => !v)}
            className="h-9 rounded-md border border-black/10 text-xs text-left px-3"
          >
            Mentioned: {channelMentioned ? "Yes" : "No"}
          </button>
        </div>

        {workKind === "code_analysis" ? (
          <Input
            value={workspacePath}
            onChange={(e) => setWorkspacePath(e.target.value)}
            placeholder="Workspace path (optional) — e.g. Web/lib/guardmesh-kv-sync-from-chain.ts"
            className="font-mono text-xs h-9"
          />
        ) : null}

        {workKind === "read_file" ? (
          <Input
            value={workspacePath}
            onChange={(e) => setWorkspacePath(e.target.value)}
            placeholder="Workspace path (required) — e.g. Web/lib"
            className="font-mono text-xs h-9"
          />
        ) : null}

        {workKind === "query_db" ? (
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              value={dbUri}
              onChange={(e) => setDbUri(e.target.value)}
              placeholder="MongoDB URI (required) — e.g. mongodb://localhost:27017/kite-garden"
              className="font-mono text-xs h-9 flex-1 min-w-[260px]"
            />
            <Select value={dbOp} onValueChange={(v) => setDbOp(v as "listCollections" | "sample")}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listCollections">listCollections</SelectItem>
                <SelectItem value="sample">sample</SelectItem>
              </SelectContent>
            </Select>
            {dbOp === "sample" ? (
              <Input
                value={dbCollection}
                onChange={(e) => setDbCollection(e.target.value)}
                placeholder="Collection"
                className="font-mono text-xs h-9 flex-1 min-w-[120px]"
              />
            ) : null}
          </div>
        ) : null}

        <Textarea
          value={workDescription}
          onChange={(e) => setWorkDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              if (canChat && !gatedRunning) sendMessage()
            }
          }}
          placeholder={canChat ? "Message the agent… (Ctrl+Enter to send)" : "Connect wallet and pick an agent…"}
          disabled={!canChat || gatedRunning}
          className="min-h-[72px] max-h-[12vh] flex-1 resize-none border-0 bg-transparent text-base leading-relaxed shadow-none focus-visible:ring-0 px-1 py-2"
        />

        <div className="flex justify-end gap-2">
          <Button type="button" disabled={!canChat || gatedRunning} onClick={() => sendMessage()} className="px-6">
            {gatedRunning ? "Waiting…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Minimal inline formatting: **bold** and ``` fences */
function AssistantBubble({ text }: { text: string }) {
  const parts = text.split(/```/)
  return (
    <>
      {parts.map((chunk, i) => {
        if (i % 2 === 1) {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg p-3 text-[11px] leading-relaxed bg-black/[0.04] border border-black/[0.08] my-2"
            >
              {chunk.replace(/\n$/, "")}
            </pre>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            <FormatBold bits={chunk.split(/\*\*/)} />
          </p>
        )
      })}
    </>
  )
}

function FormatBold({ bits }: { bits: string[] }) {
  return (
    <>
      {bits.map((b, j) =>
        j % 2 === 1 ? (
          <strong key={j} className="font-semibold text-black">
            {b}
          </strong>
        ) : (
          <span key={j}>{b}</span>
        )
      )}
    </>
  )
}
