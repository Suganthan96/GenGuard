import { ethers } from "ethers";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const ETH_REGISTRAR_CONTROLLER = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";
const REGISTRATION_DURATION = 31536000n; // 1 year in seconds

const ETH_REGISTRAR_ABI = [
  "function available(string name) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium) price)",
  "function makeCommitment(tuple(string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function register(tuple(string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) payable",
];

async function main() {
  const nameToRegister = process.argv[2] || "guardmesh"; // without .eth
  console.log(`\n🚀 Starting ENS Registration for: ${nameToRegister}.eth on Sepolia`);

  const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const cleanPk = (process.env.PRIVATE_KEY || "").trim().replace(/\.$/, "");
  const wallet = new ethers.Wallet(cleanPk, provider);

  console.log(`Wallet Address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  const controller = new ethers.Contract(ETH_REGISTRAR_CONTROLLER, ETH_REGISTRAR_ABI, wallet);

  // 1. Check availability
  console.log(`1️⃣ Checking availability...`);
  const isAvailable = await controller.available(nameToRegister);
  if (!isAvailable) {
    console.error(`❌ ${nameToRegister}.eth is already registered! Please choose another name.`);
    process.exit(1);
  }
  console.log(`✅ Available!`);

  // 2. Get price
  console.log(`\n2️⃣ Calculating price...`);
  const priceData = await controller.rentPrice(nameToRegister, REGISTRATION_DURATION);
  const totalPrice = priceData.base + priceData.premium;
  // Add 10% buffer
  const valueToSend = totalPrice + (totalPrice / 10n);
  console.log(`Price + Buffer: ${ethers.formatEther(valueToSend)} ETH`);

  if (balance < valueToSend) {
    console.error(`❌ Insufficient funds!`);
    process.exit(1);
  }

  // 3. Prepare Registration Details
  const secretBytes = crypto.randomBytes(32);
  const secret = "0x" + secretBytes.toString("hex");

  const registrationParams = {
    label: nameToRegister,
    owner: wallet.address,
    duration: REGISTRATION_DURATION,
    secret: secret,
    resolver: PUBLIC_RESOLVER,
    data: [],
    reverseRecord: 0,
    referrer: ethers.ZeroHash
  };

  // 4. Commit
  console.log(`\n3️⃣ Generating commitment...`);
  const commitment = await controller.makeCommitment(registrationParams);
  console.log(`Commitment hash: ${commitment}`);

  console.log(`Sending commit transaction...`);
  const commitTx = await controller.commit(commitment);
  console.log(`Commit Tx Hash: ${commitTx.hash}`);
  await commitTx.wait(1);
  console.log(`✅ Commit transaction confirmed.`);

  // 5. Wait for minimum commitment age (60 seconds)
  console.log(`\n⏳ Waiting 65 seconds to comply with minCommitmentAge...`);
  for (let i = 65; i > 0; i--) {
    process.stdout.write(`\rTime remaining: ${i}s... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`\n✅ Wait complete.`);

  // 6. Register
  console.log(`\n4️⃣ Sending register transaction...`);
  const registerTx = await controller.register(registrationParams, { value: valueToSend });
  console.log(`Register Tx Hash: ${registerTx.hash}`);
  
  console.log(`Waiting for confirmation...`);
  await registerTx.wait(1);

  console.log(`\n🎉 Successfully registered ${nameToRegister}.eth on Sepolia!`);
  console.log(`View on Explorer: https://sepolia.etherscan.io/tx/${registerTx.hash}`);
}

main().catch(console.error);
