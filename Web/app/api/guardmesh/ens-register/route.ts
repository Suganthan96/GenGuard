import { NextResponse } from "next/server"
import { ethers } from "ethers"
import crypto from "node:crypto"
import { assertToolAuthorized } from "@/lib/guardmesh-tool-auth"

const ETH_REGISTRAR_CONTROLLER = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968"
const PUBLIC_RESOLVER_SEPOLIA = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5"
const REGISTRATION_DURATION = 31_536_000n // 1 year
const MIN_COMMIT_WAIT_SECONDS = 65

const ETH_REGISTRAR_ABI = [
  "function available(string name) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium) price)",
  "function makeCommitment(tuple(string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function register(tuple(string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) payable",
] as const

function parseLabelFromEthName(agentId: string): string | null {
  const id = agentId.trim().toLowerCase()
  if (!id.endsWith(".eth")) return null
  const label = id.slice(0, -4).trim()
  if (!label) return null
  if (label.includes(".")) return null // this route only handles second-level *.eth registration
  return label
}

export async function POST(req: Request) {
  const unauthorized = assertToolAuthorized(req)
  if (unauthorized) return unauthorized

  let body: { agent_id?: string; owner_address?: string }
  try {
    body = (await req.json()) as { agent_id?: string; owner_address?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const agentId = body.agent_id?.trim() || ""
  const label = parseLabelFromEthName(agentId)
  if (!label) {
    return NextResponse.json({ ok: false, error: "agent_id must be a second-level .eth name (e.g. awesome.eth)" }, { status: 400 })
  }

  const rpcUrl = process.env.ENS_SEPOLIA_RPC?.trim() || "https://ethereum-sepolia-rpc.publicnode.com"
  const pk = process.env.ENS_REGISTRAR_PRIVATE_KEY?.trim() || ""
  if (!pk) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing ENS_REGISTRAR_PRIVATE_KEY on Web server. Set it to a funded Sepolia wallet private key.",
      },
      { status: 500 }
    )
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const payer = new ethers.Wallet(pk, provider)
    const owner =
      body.owner_address && ethers.isAddress(body.owner_address)
        ? ethers.getAddress(body.owner_address)
        : payer.address

    const controller = new ethers.Contract(ETH_REGISTRAR_CONTROLLER, ETH_REGISTRAR_ABI, payer)

    console.info("[ens-register] start", { agentId, label, owner, payer: payer.address, rpcUrl })

    const isAvailable: boolean = await controller.available(label)
    if (!isAvailable) {
      console.info("[ens-register] already registered", { label })
      return NextResponse.json({
        ok: true,
        already_registered: true,
        name: `${label}.eth`,
        owner,
        note: "Name is already registered on Sepolia. Skipping commit/register.",
      })
    }

    const priceData = await controller.rentPrice(label, REGISTRATION_DURATION)
    const totalPrice = priceData.base + priceData.premium
    const valueToSend = totalPrice + totalPrice / 10n // 10% buffer

    const payerBal = await provider.getBalance(payer.address)
    if (payerBal < valueToSend) {
      return NextResponse.json(
        {
          ok: false,
          error: `Insufficient payer balance for ENS registration. Need ~${ethers.formatEther(valueToSend)} ETH, have ${ethers.formatEther(payerBal)} ETH.`,
          payer: payer.address,
        },
        { status: 400 }
      )
    }

    const secret = `0x${crypto.randomBytes(32).toString("hex")}`
    const registrationParams = {
      label,
      owner,
      duration: REGISTRATION_DURATION,
      secret,
      resolver: PUBLIC_RESOLVER_SEPOLIA,
      data: [] as string[],
      reverseRecord: 0,
      referrer: ethers.ZeroHash,
    }

    const commitment = await controller.makeCommitment(registrationParams)
    const commitTx = await controller.commit(commitment)
    await commitTx.wait(1)
    console.info("[ens-register] commit confirmed", { label, txHash: commitTx.hash })

    await new Promise((r) => setTimeout(r, MIN_COMMIT_WAIT_SECONDS * 1000))

    const registerTx = await controller.register(registrationParams, { value: valueToSend })
    await registerTx.wait(1)
    console.info("[ens-register] register confirmed", { label, txHash: registerTx.hash })

    return NextResponse.json({
      ok: true,
      already_registered: false,
      name: `${label}.eth`,
      owner,
      commit_tx_hash: commitTx.hash,
      register_tx_hash: registerTx.hash,
      explorer: `https://sepolia.etherscan.io/tx/${registerTx.hash}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[ens-register] error", { agentId, error: msg }, e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

