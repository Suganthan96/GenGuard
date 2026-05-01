import { toBeHex, zeroPadValue } from "ethers";

const BYTES32_HEX = /^0x[0-9a-fA-F]{64}$/i;

/** Match Web `normalizeGuardmeshKvStreamId` — SDK / RPC expect bytes32 stream id, not decimal `"1"`. */
export function normalizeGuardmeshKvStreamId(raw) {
  const s = String(raw ?? "1").trim() || "1";
  if (BYTES32_HEX.test(s)) return s;
  const n = BigInt(s);
  return zeroPadValue(toBeHex(n), 32);
}
