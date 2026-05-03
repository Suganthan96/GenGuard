import { ethers } from 'ethers';
import type { GuardMeshConfig } from './config';

// Import ABIs from your contracts
const REGISTRY_ABI = [
  'function registerAgent(string agentId, string roleScope, string[] allowedActions, string[] deniedActions) external',
  'function getAgent(string agentId) external view returns (tuple(string agentId, string roleScope, bool active, string consensusType, string[] allowedActions, string[] deniedActions, string[] dataSources))',
  'function getAllAgents() external view returns (tuple(string agentId, string roleScope, bool active, string[] allowedActions)[])',
];

const AUDIT_ABI = [
  'function recordDecision(string agentId, string merkleRoot, bool approved, uint8 outcome, string actionType, string target, uint256 approveCount, uint256 blockCount, string blockedReason, uint256 intentTimestamp) external',
  'function getDecision(string merkleRoot) external view returns (tuple(string agentId, string merkleRoot, bool approved, uint8 outcome, string actionType, string target, uint256 approveCount, uint256 blockCount, string blockedReason, uint256 intentTimestamp, uint256 recordedAt, address recorder))',
  'function getAllDecisionsPaginated(uint256 offset, uint256 limit) external view returns (tuple(string agentId, string merkleRoot, bool approved, uint8 outcome, string actionType, string target, uint256 approveCount, uint256 blockCount, string blockedReason, uint256 intentTimestamp, uint256 recordedAt, address recorder)[], uint256)',
];

export async function getContract(
  type: 'registry' | 'audit',
  config: GuardMeshConfig
): Promise<ethers.Contract> {
  if (!config.rpcUrl) {
    throw new Error('RPC URL not configured. Run: guardmesh config --rpc <url>');
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  
  let signer: ethers.Signer;
  if (config.privateKey) {
    signer = new ethers.Wallet(config.privateKey, provider);
  } else {
    // Use default signer (for read-only operations)
    signer = await provider.getSigner();
  }

  if (type === 'registry') {
    if (!config.registryAddress) {
      throw new Error('Registry address not configured. Run: guardmesh config --registry <address>');
    }
    return new ethers.Contract(config.registryAddress, REGISTRY_ABI, signer);
  }

  if (type === 'audit') {
    if (!config.auditAddress) {
      throw new Error('Audit address not configured. Run: guardmesh config --audit <address>');
    }
    return new ethers.Contract(config.auditAddress, AUDIT_ABI, signer);
  }

  throw new Error(`Unknown contract type: ${type}`);
}
