import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const rpc = process.env.ZG_RPC_ENDPOINT || "https://evmrpc-testnet.0g.ai";
const providerAddress = process.env.PROVIDER_ADDRESS || "0xa48f01287233509FD694a22Bf840225062E67836";
const expectedAddress = process.env.EXPECTED_ADDRESS || "";

function errMsg(error) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

function toConfigError(message) {
  const error = new Error(message);
  error.name = "ConfigError";
  return error;
}

function normalizePrivateKey(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    throw toConfigError("PRIVATE_KEY not set");
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!ethers.isHexString(normalized, 32)) {
    throw toConfigError("PRIVATE_KEY must be a 32-byte hex key (with or without 0x prefix)");
  }
  return normalized;
}

function validateAddress(name, value, allowEmpty = false) {
  const trimmed = String(value || "").trim();
  if (!trimmed && allowEmpty) {
    return "";
  }
  if (!ethers.isAddress(trimmed)) {
    throw toConfigError(`${name} must be a valid EVM address`);
  }
  return trimmed;
}

async function main() {
  const privateKeyHex = normalizePrivateKey(process.env.PRIVATE_KEY);
  const validatedProviderAddress = validateAddress("PROVIDER_ADDRESS", providerAddress);
  const validatedExpectedAddress = validateAddress("EXPECTED_ADDRESS", expectedAddress, true);

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKeyHex);
  const walletWithProvider = wallet.connect(provider);
  let hasFailures = false;

  function markFailure(label, error) {
    hasFailures = true;
    console.error(`${label}=${errMsg(error)}`);
  }

  const chain = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();
  const bal = await provider.getBalance(walletWithProvider.address);

  console.log(`wallet=${walletWithProvider.address}`);
  if (validatedExpectedAddress) {
    const addressMatch = walletWithProvider.address.toLowerCase() === validatedExpectedAddress.toLowerCase();
    console.log(`address_match=${addressMatch}`);
    if (!addressMatch) {
      hasFailures = true;
    }
  }
  console.log(`chain_id=${chain.chainId.toString()}`);
  console.log(`block_number=${blockNumber}`);
  console.log(`wallet_balance_0g=${ethers.formatEther(bal)}`);

  const broker = await createZGComputeNetworkBroker(walletWithProvider);
  console.log("broker_init=ok");

  try {
    const metadata = await broker.inference.getServiceMetadata(validatedProviderAddress);
    console.log(`provider=${validatedProviderAddress}`);
    console.log(`model=${metadata.model}`);
    console.log(`endpoint=${metadata.endpoint}`);
  } catch (error) {
    markFailure("metadata_error", error);
  }

  try {
    const signerStatus = await broker.inference.checkProviderSignerStatus(validatedProviderAddress);
    console.log(`tee_signer_ack=${String(signerStatus.isAcknowledged)}`);
    console.log(`tee_signer=${signerStatus.teeSignerAddress}`);
    if (!signerStatus.isAcknowledged) {
      hasFailures = true;
    }
  } catch (error) {
    markFailure("tee_signer_check_error", error);
  }

  try {
    const sub = await broker.inference.getAccount(validatedProviderAddress);
    console.log(`sub_account_balance=${sub.balance.toString()}`);
    console.log(`sub_account_pending_refund=${sub.pendingRefund.toString()}`);
  } catch (error) {
    markFailure("sub_account_error", error);
  }

  try {
    const ledger = await broker.ledger.getLedger();
    console.log(`ledger_balance=${ledger.balance.toString()}`);
  } catch (error) {
    markFailure("ledger_error", error);
  }

  if (hasFailures) {
    console.error("check_status=fail");
    process.exit(2);
  }

  console.log("check_status=pass");
}

main().catch((error) => {
  console.error(`check_failed=${errMsg(error)}`);
  process.exit(1);
});
