import path from "node:path"

/**
 * Filesystem sandbox for read_file tool. Override with GUARDMESH_WORKSPACE_ROOT.
 * Default: parent of process.cwd() (when `next dev` runs from `Web/`, this is the monorepo root).
 */
export function getWorkspaceRoot(): string {
  const env = process.env.GUARDMESH_WORKSPACE_ROOT?.trim()
  if (env) return path.resolve(env)
  return path.resolve(process.cwd(), "..")
}

/** Resolve a user-supplied path to an absolute path that must stay under the workspace root. */
export function resolveReadablePath(userPath: string): string {
  const root = path.resolve(getWorkspaceRoot())
  const raw = String(userPath || "").trim()
  if (!raw) throw new Error("path is required")
  if (raw.includes("\0")) throw new Error("path contains invalid character")

  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw)

  const rootNorm = root.replace(/\\/g, "/").toLowerCase()
  const absNorm = abs.replace(/\\/g, "/").toLowerCase()
  const inside = absNorm === rootNorm || absNorm.startsWith(rootNorm + "/")
  if (!inside) {
    throw new Error("path escapes GUARDMESH_WORKSPACE_ROOT")
  }
  return abs
}
