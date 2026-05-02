import { JsonRpcProvider } from "ethers"
import { CHAIN_ID, getGalileoReadRpcCandidates } from "@/lib/contracts-config"
import { OG_GALILEO } from "@/lib/chain-0g"

/**
 * Surface revert / RPC errors for UI (MetaMask often throws non-Error objects).
 */
export function formatContractError(err: unknown): string {
  if (err instanceof Error) return err.message

  const o = err as {
    shortMessage?: string
    reason?: string
    info?: { error?: { message?: string } }
    data?: string
  }
  if (o.shortMessage) return o.shortMessage
  if (o.reason) return o.reason
  if (o.info?.error?.message) return o.info.error.message

  const any = err as { message?: string }
  if (typeof any.message === "string" && any.message) return any.message

  try {
    const s = JSON.stringify(err)
    if (s && s !== "{}") return s.slice(0, 400)
  } catch {
    /* ignore */
  }
  return "Transaction failed."
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function getTransactionReceiptWithRpcFallback(txHash: string) {
  const urls = getGalileoReadRpcCandidates()
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const p = new JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true })
      return await p.getTransactionReceipt(txHash)
    } catch (e) {
      lastErr = e
    }
  }
  if (lastErr) throw lastErr
  return null
}

/**
 * Wait until a tx is mined, polling public RPCs with backoff.
 * Avoids `ContractTransactionResponse.wait()` on the injected wallet, which often
 * hits MetaMask’s RPC and throws on transient 500 / "endpoint unavailable" errors.
 */
export async function waitForTxConfirmed(
  txHash: string,
  options?: { timeoutMs?: number }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 180_000
  const deadline = Date.now() + timeoutMs
  let delayMs = 1500

  while (Date.now() < deadline) {
    try {
      const receipt = await getTransactionReceiptWithRpcFallback(txHash)
      if (receipt) {
        if (receipt.status === 0) {
          throw new Error("Transaction reverted on-chain.")
        }
        return
      }
    } catch (err) {
      const m = formatContractError(err).toLowerCase()
      if (m.includes("reverted on-chain")) throw err
    }
    await sleep(delayMs)
    delayMs = Math.min(Math.floor(delayMs * 1.25), 8000)
  }

  throw new Error(
    `Timed out waiting for receipt (${txHash.slice(0, 10)}…). It may still confirm — check ${OG_GALILEO.explorer}/tx/${txHash}`
  )
}

export function parseCommaList(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Validate 32-byte hex string for merkle roots */
export function parseBytes32Hex(input: string): `0x${string}` | null {
  const t = input.trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(t)) return null
  return t as `0x${string}`
}
