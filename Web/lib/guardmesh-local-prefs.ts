const STORAGE_KEY = "guardmesh:localToolPrefs:v1"

/**
 * Localhost convenience: set in Web/.env.local to match `GUARDMESH_TOOL_SECRET` so Policies
 * can call tool routes without pasting into "Save local tool settings". Inlined into the
 * client bundle — never use on a public production deployment.
 */
function toolSecretFromNextPublic(): string {
  if (typeof process === "undefined" || !process.env) return ""
  return String(process.env.NEXT_PUBLIC_GUARDMESH_TOOL_SECRET || "").trim()
}

export type GuardmeshLocalToolPrefs = {
  mongodbUri: string
  workspaceRoot: string
  openaiKey: string
  toolSecret: string
}

const empty: GuardmeshLocalToolPrefs = {
  mongodbUri: "",
  workspaceRoot: "",
  openaiKey: "",
  toolSecret: "",
}

export function loadGuardmeshLocalToolPrefs(): GuardmeshLocalToolPrefs {
  if (typeof window === "undefined") return { ...empty }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const fromEnv = toolSecretFromNextPublic()
      return { ...empty, ...(fromEnv ? { toolSecret: fromEnv } : {}) }
    }
    const o = JSON.parse(raw) as Partial<GuardmeshLocalToolPrefs>
    const toolSecret =
      (typeof o.toolSecret === "string" ? o.toolSecret : "").trim() || toolSecretFromNextPublic()
    return {
      mongodbUri: typeof o.mongodbUri === "string" ? o.mongodbUri : "",
      workspaceRoot: typeof o.workspaceRoot === "string" ? o.workspaceRoot : "",
      openaiKey: typeof o.openaiKey === "string" ? o.openaiKey : "",
      toolSecret,
    }
  } catch {
    return { ...empty }
  }
}

export function saveGuardmeshLocalToolPrefs(p: GuardmeshLocalToolPrefs): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* quota or private mode */
  }
}

export function buildEnvSnippet(p: GuardmeshLocalToolPrefs, opts?: { includeSecrets?: boolean }): string {
  const lines: string[] = []
  const inc = opts?.includeSecrets !== false
  if (p.workspaceRoot.trim()) {
    lines.push(`GUARDMESH_WORKSPACE_ROOT=${p.workspaceRoot.trim()}`)
  }
  if (p.mongodbUri.trim() && inc) {
    lines.push(`MONGODB_URI=${p.mongodbUri.trim()}`)
  } else if (p.mongodbUri.trim()) {
    lines.push(`MONGODB_URI=<set in Web/.env.local — value hidden>`)
  }
  if (p.openaiKey.trim() && inc) {
    lines.push(`OPENAI_API_KEY=${p.openaiKey.trim()}`)
  } else if (p.openaiKey.trim()) {
    lines.push(`OPENAI_API_KEY=<set in Web/.env.local — value hidden>`)
  }
  if (p.toolSecret.trim() && inc) {
    lines.push(`GUARDMESH_TOOL_SECRET=${p.toolSecret.trim()}`)
  } else if (p.toolSecret.trim()) {
    lines.push(`GUARDMESH_TOOL_SECRET=<hidden>`)
  }
  return lines.join("\n")
}
