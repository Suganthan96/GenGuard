import { NextResponse } from "next/server"

/**
 * When GUARDMESH_TOOL_SECRET is set, tool routes require Authorization: Bearer <secret>.
 * Leave unset only for local dev on trusted loopback.
 */
export function assertToolAuthorized(req: Request): NextResponse | null {
  const secret = process.env.GUARDMESH_TOOL_SECRET?.trim()
  if (!secret) return null
  const auth = req.headers.get("authorization")?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Missing or invalid Authorization Bearer token" }, { status: 401 })
  }
  return null
}
