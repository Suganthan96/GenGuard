import { NextResponse } from "next/server"
import { assertToolAuthorized } from "@/lib/guardmesh-tool-auth"
import { runQueryDb, type QueryDbOperation } from "@/lib/guardmesh-query-db"

export const runtime = "nodejs"

type Body = {
  mongodbUri?: string
  operation?: QueryDbOperation
  collection?: string
  pipeline?: unknown[]
  filter?: Record<string, unknown>
  limit?: number
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

  const op = body.operation
  if (op !== "listCollections" && op !== "sample" && op !== "aggregate") {
    return NextResponse.json(
      { error: "operation must be listCollections | sample | aggregate" },
      { status: 400 }
    )
  }

  try {
    const result = await runQueryDb({
      mongodbUri: String(body.mongodbUri ?? ""),
      operation: op,
      collection: body.collection,
      pipeline: body.pipeline,
      filter: body.filter,
      limit: body.limit,
    })
    return NextResponse.json({ action: "query_db", result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Cannot find module") || msg.includes("mongodb")) {
      return NextResponse.json(
        { error: "MongoDB driver unavailable. Run npm install in Web/." },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
