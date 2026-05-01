import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const rpc = process.env.ZG_RPC_ENDPOINT || "https://evmrpc-testnet.0g.ai";
const amountRaw = process.env.ADD_LEDGER_AMOUNT || "3";

function errMsg(error) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

function normalizePrivateKey(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    throw new Error("PRIVATE_KEY not set");
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!ethers.isHexString(normalized, 32)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex key (with or without 0x prefix)");
  }
  return normalized;
}

function parseLedgerAmount(rawValue) {
  const value = String(rawValue || "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error("ADD_LEDGER_AMOUNT must be a positive integer");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("ADD_LEDGER_AMOUNT must be a positive safe integer");
  }
  return parsed;
}

async function main() {
  const privateKey = normalizePrivateKey(process.env.PRIVATE_KEY);
  const amount = parseLedgerAmount(amountRaw);

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const broker = await createZGComputeNetworkBroker(wallet);

  await broker.ledger.addLedger(amount);
  console.log(`add_ledger=success amount=${amount}`);
}

main().catch((error) => {
  console.error(`add_ledger_failed=${errMsg(error)}`);
  process.exit(1);
});
