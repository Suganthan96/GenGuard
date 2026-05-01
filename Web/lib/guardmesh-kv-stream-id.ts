import { toBeHex, zeroPadValue } from "ethers"

const BYTES32_HEX = /^0x[0-9a-fA-F]{64}$/i

/**
 * 0G TS SDK `StreamDataBuilder` passes stream ids through `ethers.getBytes` when building tags.
 * Env `GUARDMESH_KV_STREAM_ID=1` must become a 32-byte hex string (same as padded uint on-chain).
 */
export function normalizeGuardmeshKvStreamId(raw: string | undefined): string {
  const s = (raw ?? "").trim() || "1"
  if (BYTES32_HEX.test(s)) return s
  try {
    const n = BigInt(s)
    return zeroPadValue(toBeHex(n), 32)
  } catch {
    throw new Error(
      `GUARDMESH_KV_STREAM_ID must be a decimal integer or 32-byte hex (0x + 64 hex chars); got "${s}"`
    )
  }
}
