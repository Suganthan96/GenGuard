import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import { TextDecoder } from "node:util"
import { assertToolAuthorized } from "@/lib/guardmesh-tool-auth"
import { getWorkspaceRoot, resolveReadablePath } from "@/lib/guardmesh-workspace-path"

export const runtime = "nodejs"

const MAX_FILE_BYTES = 2_000_000
const MAX_DIRECTORY_ENTRIES = 500

const utf8Strict = new TextDecoder("utf8", { fatal: true })

type Body = { path?: string }

type DirEntry = {
  name: string
  /** Path relative to workspace root, POSIX slashes. */
  relativePath: string
  kind: "file" | "directory"
}

export async function POST(req: Request) {
  const denied = assertToolAuthorized(req)
  if (denied) return denied

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  let abs: string
  try {
    abs = resolveReadablePath(String(body.path ?? ""))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const root = path.resolve(getWorkspaceRoot())

  try {
    const stat = await fs.stat(abs)

    if (stat.isDirectory()) {
      const dirents = await fs.readdir(abs, { withFileTypes: true })
      const sorted = dirents.sort((a, b) => a.name.localeCompare(b.name))
      const slice = sorted.slice(0, MAX_DIRECTORY_ENTRIES)
      const entries: DirEntry[] = slice.map((d) => {
        const rel = path.relative(root, path.join(abs, d.name)).replace(/\\/g, "/")
        return {
          name: d.name,
          relativePath: rel,
          kind: d.isDirectory() ? "directory" : "file",
        }
      })
      return NextResponse.json({
        kind: "directory" as const,
        path: abs,
        workspaceRoot: root,
        truncated: sorted.length > MAX_DIRECTORY_ENTRIES,
        totalEntries: sorted.length,
        entries,
      })
    }

    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file or directory" }, { status: 400 })
    }

    if (stat.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES} bytes)` },
        { status: 413 }
      )
    }

    const buf = await fs.readFile(abs)
    if (buf.includes(0)) {
      return NextResponse.json({
        kind: "file" as const,
        path: abs,
        workspaceRoot: root,
        bytes: stat.size,
        encoding: "base64" as const,
        content: buf.toString("base64"),
        note: "Returned as base64 because the file contains null bytes.",
      })
    }
    try {
      const text = utf8Strict.decode(buf)
      return NextResponse.json({
        kind: "file" as const,
        path: abs,
        workspaceRoot: root,
        bytes: stat.size,
        encoding: "utf8" as const,
        content: text,
      })
    } catch {
      return NextResponse.json({
        kind: "file" as const,
        path: abs,
        workspaceRoot: root,
        bytes: stat.size,
        encoding: "base64" as const,
        content: buf.toString("base64"),
        note: "Returned as base64 because content is not valid UTF-8.",
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = (e as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
