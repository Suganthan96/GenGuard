/**
 * GET /api/guardmesh/retrieve-bundle?merkleRoot=0x...
 * 
 * Retrieves a decision bundle from 0G Storage using the merkle root,
 * verifies it against on-chain GuardMeshAudit data, and decrypts if needed.
 */

import { NextRequest, NextResponse } from "next/server"
import { retrieveDecisionBundle } from "@/lib/guardmesh-phase6-retrieval"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const merkleRoot = searchParams.get("merkleRoot")

  console.log("═══════════════════════════════════════════════════════")
  console.log("🌐 API: /api/guardmesh/retrieve-bundle")
  console.log("═══════════════════════════════════════════════════════")
  console.log("📋 Request Merkle Root:", merkleRoot)
  console.log("⏰ Timestamp:", new Date().toISOString())

  if (!merkleRoot) {
    console.error("❌ Missing merkleRoot parameter")
    return NextResponse.json(
      { ok: false, error: "Missing merkleRoot query parameter" },
      { status: 400 }
    )
  }

  try {
    console.log("🔄 Calling retrieveDecisionBundle...")
    const result = await retrieveDecisionBundle(merkleRoot)

    if (!result.ok) {
      console.error("❌ Retrieval failed")
      console.error("   Stage:", result.stage)
      console.error("   Error:", result.message)
      return NextResponse.json(
        {
          ok: false,
          stage: result.stage,
          error: result.message,
        },
        { status: result.stage === "on_chain" ? 404 : 502 }
      )
    }

    console.log("✅ Retrieval successful")
    console.log("   Verified:", result.verified)
    console.log("   Bundle size:", JSON.stringify(result.bundle).length, "bytes")
    console.log("═══════════════════════════════════════════════════════\n")

    return NextResponse.json({
      ok: true,
      merkleRoot: result.merkleRoot,
      bundle: result.bundle,
      onChainData: {
        ...result.onChainData,
        intentTimestamp: result.onChainData.intentTimestamp.toString(),
        recordedAt: result.onChainData.recordedAt.toString(),
      },
      verified: result.verified,
      verificationNotes: result.verificationNotes,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("❌ Unexpected error in API handler:", message)
    console.error("   Stack:", e instanceof Error ? e.stack : "N/A")
    return NextResponse.json(
      { ok: false, error: `Unexpected error: ${message}` },
      { status: 500 }
    )
  }
}
