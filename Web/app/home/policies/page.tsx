"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useWallet } from "@/contexts/wallet-context"
import { useGuardmeshContracts } from "@/hooks/use-guardmesh-contracts"
import type { RegistryPolicy } from "@/lib/guardmesh-contracts"
import {
  buildEnvSnippet,
  loadGuardmeshLocalToolPrefs,
  saveGuardmeshLocalToolPrefs,
  type GuardmeshLocalToolPrefs,
} from "@/lib/guardmesh-local-prefs"
import { parseCommaList } from "@/lib/tx-utils"
import { THRESHOLD, thresholdLabel } from "@/lib/contracts-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  mergeAllowedActions,
  PolicyAllowedActionsPicker,
  splitAllowedActions,
  type GuardmeshActionId,
} from "@/components/policy-allowed-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatContractError } from "@/lib/tx-utils"
import { OG_GALILEO } from "@/lib/chain-0g"

type Tab = "mine" | "network"
type KvSyncResult =
  | { ok: true; agentId: string; txHash: string; rootHash: string; explorer?: string }
  | { ok: false; agentId: string; error: string }
type AgentTxRow = {
  kind: "registered" | "policy_updated" | "deactivated" | "reactivated"
  txHash: string
  blockNumber: number
  logIndex: number
}

/**
 * Push on-chain `getPolicy` to 0G KV (`POST /api/guardmesh/kv-sync`) so KV cannot drift from the registry.
 * Guardians with `GUARDMESH_KV_NODE_URL` require this row. Needs local tool Bearer + server
 * `GUARDMESH_TOOL_SECRET` + `GUARDMESH_KV_WRITER_PRIVATE_KEY`.
 */
async function syncKvFromChain(agentId: string): Promise<KvSyncResult> {
  const id = agentId.trim()
  if (!id) {
    return { ok: false, agentId: "", error: "agent_id is empty" }
  }
  const { toolSecret } = loadGuardmeshLocalToolPrefs()
  const fallback = process.env.NEXT_PUBLIC_GUARDMESH_TOOL_SECRET?.trim() || ""
  const bearer = toolSecret.trim() || fallback
  if (!bearer) {
    const msg =
      "Missing GuardMesh tool secret. Set local tool secret in Policy editor, or NEXT_PUBLIC_GUARDMESH_TOOL_SECRET for localhost."
    toast.message(msg)
    return { ok: false, agentId: id, error: msg }
  }
  try {
    const r = await fetch("/api/guardmesh/kv-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ agent_id: id }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      console.error("[Policies kv-sync] failed", { agent_id: id, status: r.status, error: j.error })
      const msg = j.error || String(r.status)
      toast.error(`On-chain saved; 0G KV sync failed: ${msg}`)
      return { ok: false, agentId: id, error: msg }
    }
    const j = (await r.json()) as {
      txHash?: string
      rootHash?: string
      galileo_tx_explorer?: string
      agent_id?: string
    }
    console.info("[Policies kv-sync] ok", {
      agent_id: j.agent_id ?? id,
      txHash: j.txHash,
      rootHash: j.rootHash,
      explorer: j.galileo_tx_explorer,
    })
    toast.success("0G KV synced from on-chain policy")
    return {
      ok: true,
      agentId: j.agent_id ?? id,
      txHash: j.txHash || "",
      rootHash: j.rootHash || "",
      explorer: j.galileo_tx_explorer,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.error(`0G KV sync error: ${msg}`)
    return { ok: false, agentId: id, error: msg }
  }
}

const ROLE_PRESETS = [
  { value: "code_analysis_only", label: "Code analysis only" },
  { value: "read_file_only", label: "Read file only" },
  { value: "query_db_only", label: "MongoDB / query only" },
  { value: "openclaw_guardmesh", label: "OpenClaw + GuardMesh (mixed)" },
] as const

function rolePresetValue(role: string): string {
  const r = role.trim()
  return ROLE_PRESETS.some((p) => p.value === r) ? r : "__custom__"
}

export default function PolicyEditorPage() {
  const { address, is0gNetwork } = useWallet()
  const { registryRead, runRegistryTx, registryTxBusy } = useGuardmeshContracts()

  const [tab, setTab] = useState<Tab>("mine")
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [myPolicies, setMyPolicies] = useState<RegistryPolicy[]>([])
  const [networkPolicies, setNetworkPolicies] = useState<RegistryPolicy[]>([])

  const [regAgentId, setRegAgentId] = useState("")
  const [regRoleSelect, setRegRoleSelect] = useState<string>("code_analysis_only")
  const [regRoleCustom, setRegRoleCustom] = useState("")
  const [regKnown, setRegKnown] = useState<GuardmeshActionId[]>([
    "read_file",
    "code_analysis",
    "query_db",
  ])
  const [regExtraAllowed, setRegExtraAllowed] = useState("")

  const [editKnown, setEditKnown] = useState<GuardmeshActionId[]>([])
  const [editExtraAllowed, setEditExtraAllowed] = useState("")
  const [editDenied, setEditDenied] = useState("")
  const [editSources, setEditSources] = useState("")
  const [editThreshold, setEditThreshold] = useState<string>(String(THRESHOLD.MAJORITY))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [lastKvSync, setLastKvSync] = useState<KvSyncResult | null>(null)
  const [agentTxRows, setAgentTxRows] = useState<AgentTxRow[]>([])
  const [agentTxLoading, setAgentTxLoading] = useState(false)
  const [agentTxErr, setAgentTxErr] = useState<string | null>(null)

  const [toolPrefs, setToolPrefs] = useState<GuardmeshLocalToolPrefs>({
    mongodbUri: "",
    workspaceRoot: "",
    openaiKey: "",
    toolSecret: "",
  })

  useEffect(() => {
    setToolPrefs(loadGuardmeshLocalToolPrefs())
  }, [])

  const updateToolPrefs = (patch: Partial<GuardmeshLocalToolPrefs>) => {
    setToolPrefs((prev) => ({ ...prev, ...patch }))
  }

  const persistToolPrefs = () => {
    saveGuardmeshLocalToolPrefs(toolPrefs)
    toast.success("Saved tool settings in this browser (not on-chain).")
  }

  const copyEnv = (includeSecrets: boolean) => {
    const text = buildEnvSnippet(toolPrefs, { includeSecrets })
    if (!text.trim()) {
      toast.message("Nothing to copy — fill at least one field above.")
      return
    }
    void navigator.clipboard.writeText(text).then(() => {
      toast.success(includeSecrets ? "Copied lines for .env.local" : "Copied redacted lines")
    })
  }

  const loadNetwork = useCallback(async () => {
    try {
      const [page] = await registryRead.getAllAgentsPaginated(0, 30)
      setNetworkPolicies(page as unknown as RegistryPolicy[])
    } catch (e) {
      setLoadErr(formatContractError(e))
    }
  }, [registryRead])

  const loadMine = useCallback(async () => {
    if (!address) {
      setMyPolicies([])
      return
    }
    setLoading(true)
    setLoadErr(null)
    try {
      const ids: string[] = await registryRead.getOwnerAgents(address)
      const policies: RegistryPolicy[] = []
      for (const id of ids) {
        try {
          const p = await registryRead.getPolicy(id)
          policies.push(p as unknown as RegistryPolicy)
        } catch {
          /* skip missing */
        }
      }
      setMyPolicies(policies)
      if (policies.length) {
        setSelectedId((prev) => prev ?? policies[0].agentId)
      } else {
        setSelectedId(null)
      }
    } catch (e) {
      setLoadErr(formatContractError(e))
    } finally {
      setLoading(false)
    }
  }, [address, registryRead])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  useEffect(() => {
    if (tab === "network") {
      setLoadErr(null)
      void loadNetwork()
    }
  }, [tab, loadNetwork])

  const selected = myPolicies.find((p) => p.agentId === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    const { known, otherCsv } = splitAllowedActions(selected.allowedActions)
    setEditKnown(known)
    setEditExtraAllowed(otherCsv)
    setEditDenied(selected.deniedActions.join(", "))
    setEditSources(selected.allowedDataSources.join(", "))
    setEditThreshold(String(selected.consensusThreshold))
  }, [selected])

  useEffect(() => {
    if (policyDialogOpen && !selected) setPolicyDialogOpen(false)
  }, [policyDialogOpen, selected])

  const loadAgentTxHistory = useCallback(
    async (agentId: string) => {
      const id = agentId.trim()
      if (!id) {
        setAgentTxRows([])
        return
      }
      setAgentTxLoading(true)
      setAgentTxErr(null)
      try {
        const [registered, updated, deactivated, reactivated] = await Promise.all([
          registryRead.queryFilter(registryRead.filters.AgentRegistered(id), 0, "latest"),
          registryRead.queryFilter(registryRead.filters.PolicyUpdated(id), 0, "latest"),
          registryRead.queryFilter(registryRead.filters.AgentDeactivated(id), 0, "latest"),
          registryRead.queryFilter(registryRead.filters.AgentReactivated(id), 0, "latest"),
        ])

        const rows: AgentTxRow[] = [
          ...registered.map((e) => ({
            kind: "registered" as const,
            txHash: e.transactionHash,
            blockNumber: Number(e.blockNumber),
            logIndex: Number(e.index),
          })),
          ...updated.map((e) => ({
            kind: "policy_updated" as const,
            txHash: e.transactionHash,
            blockNumber: Number(e.blockNumber),
            logIndex: Number(e.index),
          })),
          ...deactivated.map((e) => ({
            kind: "deactivated" as const,
            txHash: e.transactionHash,
            blockNumber: Number(e.blockNumber),
            logIndex: Number(e.index),
          })),
          ...reactivated.map((e) => ({
            kind: "reactivated" as const,
            txHash: e.transactionHash,
            blockNumber: Number(e.blockNumber),
            logIndex: Number(e.index),
          })),
        ]

        rows.sort((a, b) => {
          if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber
          return b.logIndex - a.logIndex
        })
        setAgentTxRows(rows)
      } catch (e) {
        setAgentTxErr(formatContractError(e))
      } finally {
        setAgentTxLoading(false)
      }
    },
    [registryRead]
  )

  useEffect(() => {
    if (!policyDialogOpen || !selected?.agentId) return
    void loadAgentTxHistory(selected.agentId)
  }, [policyDialogOpen, selected?.agentId, loadAgentTxHistory])

  const resolvedRegRole =
    regRoleSelect === "__custom__" ? regRoleCustom.trim() : regRoleSelect.trim() || "code_analysis_only"

  const onRegister = async () => {
    if (!address || !is0gNetwork) return
    const role = resolvedRegRole || "code_analysis_only"
    const allowed = mergeAllowedActions(regKnown, regExtraAllowed)
    const ok = await runRegistryTx("Agent registered", (reg) =>
      reg.registerAgent.populateTransaction(regAgentId.trim(), role, allowed)
    )
    if (ok) {
      const id = regAgentId.trim()
      setRegAgentId("")
      await loadMine()
      if (id) setSelectedId(id)
      setLastKvSync(await syncKvFromChain(id))
    }
  }

  const onSavePolicy = async () => {
    if (!selected || !is0gNetwork) return
    const allowed = mergeAllowedActions(editKnown, editExtraAllowed)
    const ok = await runRegistryTx("Policy updated", (reg) =>
      reg.updatePolicy.populateTransaction(
        selected.agentId,
        allowed,
        parseCommaList(editDenied),
        parseCommaList(editSources),
        Number(editThreshold)
      )
    )
    if (ok) {
      await loadMine()
      setLastKvSync(await syncKvFromChain(selected.agentId))
    }
  }

  const onDeactivate = async () => {
    if (!selected || !is0gNetwork) return
    const ok = await runRegistryTx("Agent deactivated", (reg) =>
      reg.deactivateAgent.populateTransaction(selected.agentId)
    )
    if (ok) {
      await loadMine()
      setLastKvSync(await syncKvFromChain(selected.agentId))
    }
  }

  const onReactivate = async () => {
    if (!selected || !is0gNetwork) return
    const ok = await runRegistryTx("Agent reactivated", (reg) =>
      reg.reactivateAgent.populateTransaction(selected.agentId)
    )
    if (ok) {
      await loadMine()
      setLastKvSync(await syncKvFromChain(selected.agentId))
    }
  }

  const regShowRead = regKnown.includes("read_file")
  const regShowCode = regKnown.includes("code_analysis")
  const regShowMongo = regKnown.includes("query_db")
  const regShowAnyTools = regShowRead || regShowCode || regShowMongo

  const editShowRead = editKnown.includes("read_file")
  const editShowCode = editKnown.includes("code_analysis")
  const editShowMongo = editKnown.includes("query_db")
  const editShowAnyTools = editShowRead || editShowCode || editShowMongo

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight">Policy editor</h1>
        <p className="mt-2 text-sm text-black/45 leading-relaxed max-w-2xl">
          Register agents and update policies on <strong>GuardMeshRegistry</strong>. Writes use your
          connected wallet on 0G Galileo and cost testnet 0G gas.
        </p>
        <p className="mt-2 text-xs text-black/40 leading-relaxed max-w-2xl">
          Only one registry transaction runs at a time here so MetaMask does not stack Queued txs.
          If Activity stays Pending, MetaMask cannot reach the chain RPC — open the network in MetaMask
          and set the URL to <span className="font-mono text-[11px]">{OG_GALILEO.rpcUrl}</span>, or
          cancel the stuck tx and retry once.
        </p>
        <p className="mt-2 text-xs text-black/40 leading-relaxed max-w-2xl">
          After each successful registry write, this page calls{" "}
          <span className="font-mono text-[11px]">POST /api/guardmesh/kv-sync</span> to copy{" "}
          <strong>on-chain</strong> <span className="font-mono text-[11px]">getPolicy</span> into{" "}
          <strong>0G KV</strong> (same key as <span className="font-mono text-[11px]">agent_id</span>), so
          guardians with <span className="font-mono text-[11px]">GUARDMESH_KV_NODE_URL</span> stay aligned
          with the registry.           Match server <span className="font-mono text-[11px]">GUARDMESH_TOOL_SECRET</span> via Policy
          editor below, or set <span className="font-mono text-[11px]">NEXT_PUBLIC_GUARDMESH_TOOL_SECRET</span>{" "}
          in <span className="font-mono text-[11px]">Web/.env.local</span> (localhost only). Configure{" "}
          <span className="font-mono text-[11px]">GUARDMESH_KV_WRITER_PRIVATE_KEY</span> on the Web server for KV writes.
        </p>
        {!address ? (
          <p className="mt-3 text-xs text-amber-800/90">Connect wallet from the landing page header to manage your agents.</p>
        ) : !is0gNetwork ? (
          <p className="mt-3 text-xs text-amber-800/90">Switch MetaMask to 0G Galileo (chain 16602) to submit transactions.</p>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-black/[0.08] pb-2">
        {(
          [
            ["mine", "My agents"],
            ["network", "All on-chain"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              "text-xs tracking-wide px-3 py-1.5 rounded-lg transition-colors " +
              (tab === k ? "bg-black/[0.08] text-black" : "text-black/45 hover:text-black")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loadErr ? <p className="text-sm text-red-700/90">{loadErr}</p> : null}
      {lastKvSync ? (
        <section
          className={
            "rounded-xl border p-3 text-xs " +
            (lastKvSync.ok
              ? "border-emerald-300/60 bg-emerald-50/50 text-emerald-900"
              : "border-amber-300/60 bg-amber-50/50 text-amber-900")
          }
        >
          {lastKvSync.ok ? (
            <div className="space-y-1">
              <div>
                0G KV sync complete for <span className="font-mono">{lastKvSync.agentId}</span>
              </div>
              <div className="font-mono break-all">txHash: {lastKvSync.txHash || "n/a"}</div>
              <div className="font-mono break-all">rootHash: {lastKvSync.rootHash || "n/a"}</div>
              {lastKvSync.explorer ? (
                <a
                  href={lastKvSync.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Open on explorer
                </a>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              <div>
                On-chain write succeeded, but 0G KV sync failed for{" "}
                <span className="font-mono">{lastKvSync.agentId}</span>
              </div>
              <div className="font-mono break-all">{lastKvSync.error}</div>
            </div>
          )}
        </section>
      ) : null}

      {tab === "network" ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-black/35">Read-only · first 30 agents</h2>
          <ul className="space-y-3">
            {networkPolicies.map((p) => (
              <li
                key={p.agentId}
                className="rounded-2xl border border-black/[0.07] bg-white/90 p-5 text-sm"
              >
                <div className="font-medium">{p.agentId}</div>
                <div className="text-xs text-black/40 mt-1">Owner {p.owner}</div>
                <div className="text-xs mt-2 text-black/55">Scope: {p.roleScope}</div>
                <div className="text-[11px] text-black/35 mt-1">
                  Threshold: {thresholdLabel(p.consensusThreshold)} · Active: {p.active ? "yes" : "no"}
                </div>
              </li>
            ))}
          </ul>
          {networkPolicies.length === 0 ? (
            <p className="text-sm text-black/40">No agents registered yet, or RPC error.</p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-black/[0.07] bg-white/90 p-6 space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-black/35">Register new agent</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agent ID</Label>
                <Input value={regAgentId} onChange={(e) => setRegAgentId(e.target.value)} placeholder="eng-assistant-04" />
              </div>
              <div className="space-y-2">
                <Label>Role scope</Label>
                <Select
                  value={regRoleSelect}
                  onValueChange={(v) => {
                    setRegRoleSelect(v)
                    if (v !== "__custom__") setRegRoleCustom("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {regRoleSelect === "__custom__" ? (
                  <Input
                    value={regRoleCustom}
                    onChange={(e) => setRegRoleCustom(e.target.value)}
                    placeholder="e.g. staging_reviewer"
                    className="mt-2"
                  />
                ) : null}
                <p className="text-[11px] text-black/35">
                  Stored on-chain as <span className="font-mono">roleScope</span>. Must align with intents
                  (e.g. <span className="font-mono">code_analysis_only</span>).
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allowed actions</Label>
              <PolicyAllowedActionsPicker ids={regKnown} onChange={setRegKnown} idPrefix="reg" />
              <div className="space-y-1 pt-1">
                <Label className="text-[11px] text-black/40">Additional on-chain actions (optional)</Label>
                <Input
                  value={regExtraAllowed}
                  onChange={(e) => setRegExtraAllowed(e.target.value)}
                  placeholder="comma-separated ids not in the list above"
                  className="font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-black/35 leading-relaxed">
                On-chain tokens for OpenClaw + GuardMesh: <span className="font-mono">read_file</span>,{" "}
                <span className="font-mono">code_analysis</span>, <span className="font-mono">query_db</span>.
                Intents may use <span className="font-mono">db_analysis</span> as an alias for{" "}
                <span className="font-mono">query_db</span>.
              </p>
            </div>

            {regShowAnyTools ? (
              <div className="space-y-4 rounded-xl border border-amber-200/60 bg-amber-50/40 p-4">
                <div>
                  <h3 className="text-sm font-medium text-black/80">Tool server settings (local browser)</h3>
                  <p className="text-[11px] text-black/45 mt-1 leading-relaxed">
                    Secrets are <strong>not</strong> written to the chain. They are kept in this browser so you can
                    copy lines into <span className="font-mono">Web/.env.local</span> for the Next.js server (
                    <span className="font-mono">/api/guardmesh/run/*</span> routes).
                  </p>
                </div>
                {regShowRead ? (
                  <div className="space-y-2">
                    <Label>
                      Workspace root <span className="font-mono text-[11px] text-black/40">GUARDMESH_WORKSPACE_ROOT</span>
                    </Label>
                    <Input
                      value={toolPrefs.workspaceRoot}
                      onChange={(e) => updateToolPrefs({ workspaceRoot: e.target.value })}
                      placeholder="C:\Users\you\projects\open (repo root for read_file)"
                      className="font-mono text-xs"
                    />
                  </div>
                ) : null}
                {regShowCode ? (
                  <div className="space-y-2">
                    <Label>
                      OpenAI API key <span className="font-mono text-[11px] text-black/40">OPENAI_API_KEY</span>
                    </Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={toolPrefs.openaiKey}
                      onChange={(e) => updateToolPrefs({ openaiKey: e.target.value })}
                      placeholder="sk-… (paste, then Save local — never commit)"
                      className="font-mono text-xs"
                    />
                  </div>
                ) : null}
                {regShowMongo ? (
                  <div className="space-y-2">
                    <Label>
                      MongoDB URI <span className="font-mono text-[11px] text-black/40">MONGODB_URI</span>
                    </Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={toolPrefs.mongodbUri}
                      onChange={(e) => updateToolPrefs({ mongodbUri: e.target.value })}
                      placeholder="mongodb+srv://…"
                      className="font-mono text-xs"
                    />
                  </div>
                ) : null}
                {regShowAnyTools ? (
                  <div className="space-y-2">
                    <Label>
                      Tool route secret (optional){" "}
                      <span className="font-mono text-[11px] text-black/40">GUARDMESH_TOOL_SECRET</span>
                    </Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={toolPrefs.toolSecret}
                      onChange={(e) => updateToolPrefs({ toolSecret: e.target.value })}
                      placeholder="Bearer token for POST /api/guardmesh/run/*"
                      className="font-mono text-xs"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={persistToolPrefs}>
                    Save local tool settings
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => copyEnv(true)}>
                    Copy .env lines
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => copyEnv(false)}>
                    Copy redacted
                  </Button>
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              disabled={!address || !is0gNetwork || registryTxBusy}
              onClick={() => void onRegister()}
            >
              {registryTxBusy ? "Transaction in progress…" : "registerAgent"}
            </Button>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-black/35">Agents</h2>
            {loading ? <p className="text-sm text-black/40">Loading…</p> : null}
            {!loading && myPolicies.length === 0 ? (
              <p className="text-sm text-black/40">No agents owned by this wallet yet.</p>
            ) : null}

            {myPolicies.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {myPolicies.map((p) => (
                  <button
                    key={p.agentId}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.agentId)
                      setPolicyDialogOpen(true)
                    }}
                    className="rounded-xl border border-black/[0.1] bg-white/90 p-3 text-left shadow-sm transition hover:border-black/20 hover:bg-white"
                  >
                    <div className="text-sm font-medium tracking-tight truncate">{p.agentId}</div>
                    <div className="text-[10px] text-black/40 truncate mt-1">{p.roleScope}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[10px] text-black/35">
                      <span className={p.active ? "text-emerald-800/90" : "text-black/40"}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                      <span>·</span>
                      <span>{p.allowedActions.length} actions</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
              <DialogContent
                className="sm:max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto gap-0 p-0"
                showCloseButton
              >
                {selected ? (
                  <div className="p-6 space-y-4">
                    <DialogHeader className="space-y-1 text-left">
                      <DialogTitle className="text-xl font-light tracking-tight pr-8">
                        {selected.agentId}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-black/45 text-left space-y-1">
                        <span className="block">Role: {selected.roleScope}</span>
                        <span className="block text-black/35">
                          Updated {new Date(Number(selected.updatedAt) * 1000).toLocaleString()}
                        </span>
                      </DialogDescription>
                    </DialogHeader>

                    <p className="text-[11px] text-black/35">
                      <span className="font-mono">roleScope</span> is set at registration; this page does not change it
                      on-chain.
                    </p>

                    <div className="space-y-2">
                      <Label>Allowed actions</Label>
                      <PolicyAllowedActionsPicker ids={editKnown} onChange={setEditKnown} idPrefix="edit" />
                      <div className="space-y-1 pt-1">
                        <Label className="text-[11px] text-black/40">Additional on-chain actions (optional)</Label>
                        <Input
                          value={editExtraAllowed}
                          onChange={(e) => setEditExtraAllowed(e.target.value)}
                          placeholder="comma-separated"
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Denied actions</Label>
                      <Input value={editDenied} onChange={(e) => setEditDenied(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Allowed data sources</Label>
                      <Input value={editSources} onChange={(e) => setEditSources(e.target.value)} />
                    </div>
                    <div className="space-y-2 max-w-xs">
                      <Label>Consensus threshold</Label>
                      <Select value={editThreshold} onValueChange={setEditThreshold}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={String(THRESHOLD.ANY)}>Any 1 guardian</SelectItem>
                          <SelectItem value={String(THRESHOLD.MAJORITY)}>Majority (2/3)</SelectItem>
                          <SelectItem value={String(THRESHOLD.UNANIMOUS)}>Unanimous (3/3)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>On-chain transaction hashes</Label>
                      {agentTxLoading ? (
                        <p className="text-xs text-black/45">Loading transaction history…</p>
                      ) : agentTxErr ? (
                        <p className="text-xs text-red-700/90">{agentTxErr}</p>
                      ) : agentTxRows.length === 0 ? (
                        <p className="text-xs text-black/45">No transactions found for this agent yet.</p>
                      ) : (
                        <div className="rounded-xl border border-black/[0.07] bg-white/70 divide-y divide-black/[0.05]">
                          {agentTxRows.slice(0, 12).map((row) => (
                            <div
                              key={`${row.txHash}-${row.logIndex}`}
                              className="px-3 py-2 text-xs flex flex-col gap-1"
                            >
                              <div className="text-black/50 uppercase tracking-wide">
                                {row.kind.replace("_", " ")} · block {row.blockNumber}
                              </div>
                              <a
                                href={`${OG_GALILEO.explorer}/tx/${row.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono break-all underline underline-offset-2"
                              >
                                {row.txHash}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {editShowAnyTools ? (
                      <div className="space-y-4 rounded-xl border border-amber-200/60 bg-amber-50/40 p-4">
                        <h3 className="text-sm font-medium text-black/80">
                          Tool settings for this agent&apos;s actions
                        </h3>
                        <p className="text-[11px] text-black/45 leading-relaxed">
                          Same local browser store as above. Fields appear based on this agent&apos;s allowed actions.
                        </p>
                        {editShowRead ? (
                          <div className="space-y-2">
                            <Label>
                              Workspace root{" "}
                              <span className="font-mono text-[11px] text-black/40">GUARDMESH_WORKSPACE_ROOT</span>
                            </Label>
                            <Input
                              value={toolPrefs.workspaceRoot}
                              onChange={(e) => updateToolPrefs({ workspaceRoot: e.target.value })}
                              placeholder="Repo root for read_file"
                              className="font-mono text-xs"
                            />
                          </div>
                        ) : null}
                        {editShowCode ? (
                          <div className="space-y-2">
                            <Label>
                              OpenAI API key{" "}
                              <span className="font-mono text-[11px] text-black/40">OPENAI_API_KEY</span>
                            </Label>
                            <Input
                              type="password"
                              autoComplete="off"
                              value={toolPrefs.openaiKey}
                              onChange={(e) => updateToolPrefs({ openaiKey: e.target.value })}
                              placeholder="sk-…"
                              className="font-mono text-xs"
                            />
                          </div>
                        ) : null}
                        {editShowMongo ? (
                          <div className="space-y-2">
                            <Label>
                              MongoDB URI <span className="font-mono text-[11px] text-black/40">MONGODB_URI</span>
                            </Label>
                            <Input
                              type="password"
                              autoComplete="off"
                              value={toolPrefs.mongodbUri}
                              onChange={(e) => updateToolPrefs({ mongodbUri: e.target.value })}
                              placeholder="mongodb+srv://…"
                              className="font-mono text-xs"
                            />
                          </div>
                        ) : null}
                        {editShowAnyTools ? (
                          <div className="space-y-2">
                            <Label>
                              Tool route secret (optional){" "}
                              <span className="font-mono text-[11px] text-black/40">GUARDMESH_TOOL_SECRET</span>
                            </Label>
                            <Input
                              type="password"
                              autoComplete="off"
                              value={toolPrefs.toolSecret}
                              onChange={(e) => updateToolPrefs({ toolSecret: e.target.value })}
                              className="font-mono text-xs"
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={persistToolPrefs}>
                            Save local tool settings
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => copyEnv(true)}>
                            Copy .env lines
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-black/[0.06]">
                      <Button
                        type="button"
                        disabled={!is0gNetwork || registryTxBusy}
                        onClick={() => void onSavePolicy()}
                      >
                        updatePolicy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!is0gNetwork || !selected.active || registryTxBusy}
                        onClick={() => void onDeactivate()}
                      >
                        deactivateAgent
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!is0gNetwork || selected.active || registryTxBusy}
                        onClick={() => void onReactivate()}
                      >
                        reactivateAgent
                      </Button>
                    </div>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>
          </section>
        </>
      )}
    </div>
  )
}
