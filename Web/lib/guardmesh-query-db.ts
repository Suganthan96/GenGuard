const MAX_PIPELINE_STAGES = 12
const MAX_SAMPLE_LIMIT = 50
const MAX_RESULT_DOCS = 100

function assertSafeAggregatePipeline(pipeline: unknown[]): void {
  if (!Array.isArray(pipeline)) throw new Error("pipeline must be an array")
  if (pipeline.length > MAX_PIPELINE_STAGES) {
    throw new Error(`pipeline must have at most ${MAX_PIPELINE_STAGES} stages`)
  }
  for (let i = 0; i < pipeline.length; i++) {
    const stage = pipeline[i]
    if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
      throw new Error(`invalid pipeline stage at index ${i}`)
    }
    const keys = Object.keys(stage as Record<string, unknown>)
    if (keys.includes("$out") || keys.includes("$merge")) {
      throw new Error("$out and $merge are not allowed in query_db")
    }
  }
}

export type QueryDbOperation = "listCollections" | "sample" | "aggregate"

function normalizeMongoUri(input: string): string {
  const uri = String(input || "").trim()
  if (!uri) throw new Error("mongodbUri is required in request body")
  const lower = uri.toLowerCase()
  if (!lower.startsWith("mongodb://") && !lower.startsWith("mongodb+srv://")) {
    throw new Error("mongodbUri must start with mongodb:// or mongodb+srv://")
  }
  return uri
}

export async function runQueryDb(args: {
  mongodbUri: string
  operation: QueryDbOperation
  collection?: string
  pipeline?: unknown[]
  filter?: Record<string, unknown>
  limit?: number
}): Promise<unknown> {
  const uri = normalizeMongoUri(args.mongodbUri)
  let dbName = ""
  let host = ""
  try {
    const u = new URL(uri)
    dbName = (u.pathname || "").replace(/^\//, "").trim()
    host = u.host || ""
  } catch {
    // keep values empty; connect() will still surface URI issues.
  }

  const { MongoClient } = await import("mongodb")

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12_000 })
  try {
    await client.connect()
    const db = client.db()

    if (args.operation === "listCollections") {
      const cols = await db.listCollections().toArray()
      return {
        names: cols.map((c) => c.name).sort(),
        count: cols.length,
        dbName: db.databaseName,
        host,
      }
    }

    const collName = args.collection?.trim()
    if (!collName) {
      throw new Error("collection is required for sample and aggregate")
    }

    if (args.operation === "sample") {
      const lim = Math.min(
        Math.max(1, Number(args.limit) || 10),
        MAX_SAMPLE_LIMIT
      )
      const filter =
        args.filter && typeof args.filter === "object" && !Array.isArray(args.filter)
          ? args.filter
          : {}
      const docs = await db
        .collection(collName)
        .find(filter)
        .limit(lim)
        .toArray()
      return {
        collection: collName,
        count: docs.length,
        documents: docs,
        dbName: db.databaseName || dbName,
        host,
      }
    }

    if (args.operation === "aggregate") {
      const pipeline = args.pipeline ?? []
      assertSafeAggregatePipeline(pipeline)
      const stages = [...(pipeline as Record<string, unknown>[]), { $limit: MAX_RESULT_DOCS + 1 }]
      const documents = await db
        .collection(collName)
        .aggregate(stages, { allowDiskUse: false })
        .toArray()
      const truncated = documents.length > MAX_RESULT_DOCS
      return {
        collection: collName,
        count: Math.min(documents.length, MAX_RESULT_DOCS),
        truncated,
        documents: truncated ? documents.slice(0, MAX_RESULT_DOCS) : documents,
        dbName: db.databaseName || dbName,
        host,
      }
    }

    throw new Error(`unknown operation: ${args.operation}`)
  } finally {
    await client.close().catch(() => undefined)
  }
}
