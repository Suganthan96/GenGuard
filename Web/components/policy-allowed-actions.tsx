"use client"

import { parseCommaList } from "@/lib/tx-utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export const GUARDMESH_ACTION_IDS = ["read_file", "code_analysis", "query_db"] as const
export type GuardmeshActionId = (typeof GUARDMESH_ACTION_IDS)[number]

const LABELS: Record<GuardmeshActionId, { title: string; hint: string }> = {
  read_file: {
    title: "Read file",
    hint: "HTTP tool /api/guardmesh/run/read-file — uses GUARDMESH_WORKSPACE_ROOT",
  },
  code_analysis: {
    title: "Code analysis",
    hint: "HTTP tool /api/guardmesh/run/code-analysis — needs OPENAI_API_KEY on the server",
  },
  query_db: {
    title: "MongoDB (query_db)",
    hint: "HTTP tool /api/guardmesh/run/query-db — needs MONGODB_URI on the server",
  },
}

function orderedSelection(selected: Set<string>): GuardmeshActionId[] {
  return GUARDMESH_ACTION_IDS.filter((id) => selected.has(id))
}

/** Split chain actions into known GenGuard tokens vs everything else (preserves order). */
export function splitAllowedActions(all: string[]): {
  known: GuardmeshActionId[]
  otherCsv: string
} {
  const setKnown = new Set<string>(GUARDMESH_ACTION_IDS)
  const picked = new Set<GuardmeshActionId>()
  const other: string[] = []
  for (const raw of all) {
    const a = String(raw || "").trim()
    if (!a) continue
    if (setKnown.has(a)) picked.add(a as GuardmeshActionId)
    else other.push(a)
  }
  const known = GUARDMESH_ACTION_IDS.filter((id) => picked.has(id))
  return { known, otherCsv: other.join(", ") }
}

export function mergeAllowedActions(known: GuardmeshActionId[], otherCsv: string): string[] {
  const extra = parseCommaList(otherCsv)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of known) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  for (const x of extra) {
    if (!seen.has(x)) {
      seen.add(x)
      out.push(x)
    }
  }
  return out
}

export function formatActionTokens(ids: GuardmeshActionId[]): string {
  return ids.join(", ")
}

type Props = {
  ids: GuardmeshActionId[]
  onChange: (ids: GuardmeshActionId[]) => void
  idPrefix?: string
}

export function PolicyAllowedActionsPicker({ ids, onChange, idPrefix = "act" }: Props) {
  const selected = new Set(ids)

  const toggle = (id: GuardmeshActionId, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    onChange(orderedSelection(next))
  }

  return (
    <div className="space-y-3 rounded-xl border border-black/[0.08] bg-black/[0.02] p-4">
      {GUARDMESH_ACTION_IDS.map((id) => (
        <div key={id} className="flex gap-3 items-start">
          <Checkbox
            id={`${idPrefix}-${id}`}
            checked={selected.has(id)}
            onCheckedChange={(v) => toggle(id, v === true)}
          />
          <div className="space-y-0.5 leading-tight">
            <Label htmlFor={`${idPrefix}-${id}`} className="text-sm font-normal cursor-pointer">
              {LABELS[id].title}{" "}
              <span className="font-mono text-[11px] text-black/40">({id})</span>
            </Label>
            <p className="text-[11px] text-black/35">{LABELS[id].hint}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
