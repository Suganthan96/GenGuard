import fs from "node:fs/promises"
import path from "node:path"
import { TextDecoder } from "node:util"
import { getWorkspaceRoot, resolveReadablePath } from "@/lib/guardmesh-workspace-path"

const utf8Strict = new TextDecoder("utf8", { fatal: true })

function decodeUtf8File(buf: Buffer, label: string): string {
  if (buf.includes(0)) {
    throw new Error(`file contains null bytes (not usable as source text for code_analysis): ${label}`)
  }
  try {
    return utf8Strict.decode(buf)
  } catch {
    throw new Error(`file is not valid UTF-8 (not usable for code_analysis): ${label}`)
  }
}

/** Per-file cap for code_analysis sources (text). */
const MAX_BYTES_PER_FILE = 400_000
/** Max number of files in one code_analysis request. */
const MAX_FILES = 25
/** Total bytes read across all files (hard stop). */
const MAX_TOTAL_BYTES = 1_500_000
/** Total characters sent to the model (approximate safety cap). */
const MAX_COMBINED_CHARS = 120_000

export type GatheredSourceFile = { path: string; bytes: number; truncated: boolean }

export type GatherCodeSourcesResult = {
  combined: string
  files: GatheredSourceFile[]
}

/**
 * Resolve many user paths under the workspace, read UTF-8 text, and build one
 * `combined` string with `// === relative/path ===` headers for the analyst prompt.
 */
export async function gatherCodeFromWorkspacePaths(
  userPaths: string[]
): Promise<GatherCodeSourcesResult> {
  const unique = [...new Set(userPaths.map((p) => String(p || "").trim()).filter(Boolean))]
  if (unique.length === 0) {
    return { combined: "", files: [] }
  }
  if (unique.length > MAX_FILES) {
    throw new Error(`paths must have at most ${MAX_FILES} entries`)
  }

  const parts: string[] = []
  const files: GatheredSourceFile[] = []
  let totalBytes = 0
  /** Length of `parts.join("\n\n")` if we pushed the next block (excludes next block). */
  let combinedLen = 0
  const root = path.resolve(getWorkspaceRoot())

  for (const raw of unique) {
    const abs = resolveReadablePath(raw)
    const stat = await fs.stat(abs)
    if (!stat.isFile()) {
      throw new Error(`not a regular file: ${raw}`)
    }
    if (stat.size > MAX_BYTES_PER_FILE) {
      throw new Error(`file too large for code_analysis (${stat.size} bytes; max ${MAX_BYTES_PER_FILE}): ${raw}`)
    }
    if (totalBytes + stat.size > MAX_TOTAL_BYTES) {
      throw new Error(`total size of paths exceeds ${MAX_TOTAL_BYTES} bytes`)
    }
    totalBytes += stat.size

    const buf = await fs.readFile(abs)
    let text = decodeUtf8File(buf, raw)
    let truncated = false
    const rel = path.relative(root, abs).replace(/\\/g, "/") || path.basename(abs)
    const header = `// === ${rel} ===\n`
    const sep = parts.length === 0 ? 0 : 2
    const room = MAX_COMBINED_CHARS - combinedLen - sep - header.length - 64
    if (room <= 0) {
      throw new Error("combined source text would exceed model context cap; use fewer or smaller files")
    }
    if (text.length > room) {
      text = text.slice(0, room) + "\n\n[…truncated for model context cap…]"
      truncated = true
    }

    const block = header + text
    combinedLen += sep + block.length
    parts.push(block)
    files.push({ path: abs, bytes: stat.size, truncated })
  }

  const combined = parts.join("\n\n")
  return { combined, files }
}
