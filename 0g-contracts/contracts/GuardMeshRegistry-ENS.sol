// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GuardMeshRegistry with ENS Integration
 * @notice Extends GuardMeshRegistry to link guardian agents with ENS identities.
 *
 * Each guardian agent stores:
 *   - On-chain policy          (inherited from GuardMeshRegistry)
 *   - ENS name                 guardian-X.guardmesh.eth
 *   - ENS namehash node        (computed on-chain via ENSIP-1)
 *   - Cached metadata          role, model, version (read from ENS or set locally)
 *   - Verification timestamp   last time ENS ↔ address was verified
 *
 * ENS resolution starts on Ethereum L1.  On 0G Chain the contract stores
 * the *expected* mapping and emits events so off-chain indexers can
 * cross-validate.
 */

import "./GuardMeshRegistry.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ENS interfaces (Mainnet L1 — used only when deployed on L1 or
//   via cross-chain read; on 0G the contract stores names locally)
// ─────────────────────────────────────────────────────────────────────────────

interface IENS {
    function resolver(bytes32 node) external view returns (address);
    function owner(bytes32 node) external view returns (address);
}

interface IResolver {
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function addr(bytes32 node) external view returns (address);
}

contract GuardMeshRegistryENS is GuardMeshRegistry {

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice ENS Registry on Ethereum Mainnet (same on Sepolia)
    address public constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

    // ─────────────────────────────────────────────────────────────────────────
    // ENS Identity Storage
    // ─────────────────────────────────────────────────────────────────────────

    struct ENSIdentity {
        string   ensName;          // e.g. "guardian-1.guardmesh.eth"
        bytes32  ensNode;          // namehash of the full name
        address  resolvedAddress;  // cached resolved address
        uint256  verifiedAt;       // block.timestamp of last verification
        string   role;             // cached guardian.role
        string   model;            // cached guardian.model
        string   version;          // cached guardian.version
    }

    /// agentKey → ENS identity
    mapping(bytes32 => ENSIdentity) private _ensIdentities;

    /// ensNode → agentKey  (reverse lookup)
    mapping(bytes32 => bytes32) public ensNodeToAgent;

    /// All agent keys that have ENS names (for enumeration)
    bytes32[] private _ensAgentKeys;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AgentENSAssigned(
        string  indexed agentId,
        string          ensName,
        bytes32         ensNode,
        address indexed resolvedAddress
    );

    event AgentENSVerified(
        string  indexed agentId,
        string          ensName,
        address         resolvedAddress,
        bool            matches
    );

    event AgentENSMetadataUpdated(
        string  indexed agentId,
        string          key,
        string          value
    );

    event AgentENSRevoked(
        string  indexed agentId,
        string          ensName,
        bytes32         ensNode
    );

    // ─────────────────────────────────────────────────────────────────────────
    // On-chain namehash  (ENSIP-1 / EIP-137)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Compute the namehash for a dot-separated ENS name.
     *
     *   namehash("")                = bytes32(0)
     *   namehash("eth")             = keccak256(namehash("") ++ keccak256("eth"))
     *   namehash("guardmesh.eth")   = keccak256(namehash("eth") ++ keccak256("guardmesh"))
     */
    function computeNamehash(string memory ensName)
        public
        pure
        returns (bytes32 node)
    {
        node = bytes32(0);
        if (bytes(ensName).length == 0) return node;

        // Split on "." and process right-to-left
        bytes memory nameBytes = bytes(ensName);
        uint256 labelStart = nameBytes.length;

        // Walk backwards through the string
        for (uint256 i = nameBytes.length; i > 0; i--) {
            if (nameBytes[i - 1] == 0x2E || i == 1) {
                // Extract label
                uint256 start = (nameBytes[i - 1] == 0x2E) ? i : i - 1;
                uint256 len = labelStart - start;

                bytes memory label = new bytes(len);
                for (uint256 j = 0; j < len; j++) {
                    label[j] = nameBytes[start + j];
                }

                bytes32 labelHash = keccak256(label);
                node = keccak256(abi.encodePacked(node, labelHash));
                labelStart = i - 1;
            }
        }
    }

    /**
     * @notice Convenience: compute namehash for a guardian subname.
     * @param label  e.g. "guardian-1"
     * @param parent e.g. "guardmesh.eth"
     */
    function computeSubnameHash(string memory label, string memory parent)
        public
        pure
        returns (bytes32)
    {
        bytes32 parentNode = computeNamehash(parent);
        bytes32 labelHash  = keccak256(bytes(label));
        return keccak256(abi.encodePacked(parentNode, labelHash));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Registration with ENS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register agent with full ENS identity.
     *         Calls parent registerAgent() then links ENS name.
     */
    function registerAgentWithENS(
        string calldata agentId,
        string calldata ensName,
        address         resolvedAddress,
        string calldata roleScope,
        string[] calldata allowedActions,
        string calldata ensRole,
        string calldata ensModel,
        string calldata ensVersion
    ) external returns (bytes32) {
        // 1. Register base policy (external call, returns void)
        this.registerAgent(agentId, roleScope, allowedActions);

        // 2. Compute policy key
        bytes32 policyKey = _key(agentId);

        // 3. Compute and store ENS identity
        bytes32 ensNode = computeNamehash(ensName);

        _ensIdentities[policyKey] = ENSIdentity({
            ensName:         ensName,
            ensNode:         ensNode,
            resolvedAddress: resolvedAddress,
            verifiedAt:      block.timestamp,
            role:            ensRole,
            model:           ensModel,
            version:         ensVersion
        });

        ensNodeToAgent[ensNode] = policyKey;
        _ensAgentKeys.push(policyKey);

        emit AgentENSAssigned(agentId, ensName, ensNode, resolvedAddress);
        return policyKey;
    }

    /**
     * @notice Assign ENS name to an already-registered agent.
     */
    function assignENSName(
        string calldata agentId,
        string calldata ensName,
        address         resolvedAddress
    ) external onlyAgentOwner(agentId) {
        bytes32 key = _key(agentId);
        bytes32 ensNode = computeNamehash(ensName);

        // Clear old reverse mapping if exists
        bytes32 oldNode = _ensIdentities[key].ensNode;
        if (oldNode != bytes32(0)) {
            delete ensNodeToAgent[oldNode];
        }

        _ensIdentities[key].ensName         = ensName;
        _ensIdentities[key].ensNode         = ensNode;
        _ensIdentities[key].resolvedAddress = resolvedAddress;
        _ensIdentities[key].verifiedAt      = block.timestamp;

        ensNodeToAgent[ensNode] = key;

        // Track in list if not already tracked
        bool found = false;
        for (uint256 i = 0; i < _ensAgentKeys.length; i++) {
            if (_ensAgentKeys[i] == key) { found = true; break; }
        }
        if (!found) _ensAgentKeys.push(key);

        emit AgentENSAssigned(agentId, ensName, ensNode, resolvedAddress);
    }

    /**
     * @notice Revoke ENS association from an agent.
     */
    function revokeENSName(string calldata agentId)
        external
        onlyAgentOwner(agentId)
    {
        bytes32 key = _key(agentId);
        ENSIdentity storage eid = _ensIdentities[key];
        require(bytes(eid.ensName).length > 0, "GuardMesh: No ENS name");

        emit AgentENSRevoked(agentId, eid.ensName, eid.ensNode);

        delete ensNodeToAgent[eid.ensNode];
        delete _ensIdentities[key];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Metadata (cached on-chain)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update cached ENS metadata for an agent.
     */
    function updateENSMetadata(
        string calldata agentId,
        string calldata role,
        string calldata model,
        string calldata version
    ) external onlyAgentOwner(agentId) {
        bytes32 key = _key(agentId);
        ENSIdentity storage eid = _ensIdentities[key];
        require(bytes(eid.ensName).length > 0, "GuardMesh: No ENS name");

        if (bytes(role).length > 0)    eid.role    = role;
        if (bytes(model).length > 0)   eid.model   = model;
        if (bytes(version).length > 0) eid.version = version;

        emit AgentENSMetadataUpdated(agentId, "guardian.role",    role);
        emit AgentENSMetadataUpdated(agentId, "guardian.model",   model);
        emit AgentENSMetadataUpdated(agentId, "guardian.version", version);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getAgentENSName(string calldata agentId)
        external view returns (string memory)
    {
        return _ensIdentities[_key(agentId)].ensName;
    }

    function getAgentENSIdentity(string calldata agentId)
        external view returns (ENSIdentity memory)
    {
        return _ensIdentities[_key(agentId)];
    }

    function getAgentByENSNode(bytes32 ensNode)
        external view returns (string memory agentId)
    {
        bytes32 key = ensNodeToAgent[ensNode];
        require(key != bytes32(0), "GuardMesh: ENS node not linked");
        return _ensIdentities[key].ensName;
    }

    /**
     * @notice Verify that the stored resolved address matches expected.
     */
    function verifyAgentENS(
        string calldata agentId,
        address expectedAddress
    ) external view returns (bool) {
        bytes32 key = _key(agentId);
        ENSIdentity storage eid = _ensIdentities[key];
        if (bytes(eid.ensName).length == 0) return false;
        return eid.resolvedAddress == expectedAddress;
    }

    /**
     * @notice Return count of agents with ENS names.
     */
    function getENSAgentCount() external view returns (uint256) {
        return _ensAgentKeys.length;
    }

    /**
     * @notice Paginated list of ENS-enabled agents.
     */
    function getENSAgentsPaginated(uint256 offset, uint256 limit)
        external view
        returns (ENSIdentity[] memory page, uint256 total)
    {
        total = _ensAgentKeys.length;
        if (offset >= total) return (new ENSIdentity[](0), total);

        uint256 end   = offset + limit > total ? total : offset + limit;
        uint256 count = end - offset;
        page = new ENSIdentity[](count);

        for (uint256 i = 0; i < count; i++) {
            page[i] = _ensIdentities[_ensAgentKeys[offset + i]];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // L1 ENS verification (only works when deployed on Mainnet / fork)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Query ENS Registry on-chain and verify resolution.
     *         Only functional on Ethereum L1 or a fork.
     */
    function verifyAgentViaENSOnchain(
        string calldata agentId,
        address expectedAddress
    ) external view returns (bool) {
        bytes32 key = _key(agentId);
        ENSIdentity storage eid = _ensIdentities[key];
        if (bytes(eid.ensName).length == 0) return false;

        try IENS(ENS_REGISTRY).resolver(eid.ensNode) returns (address rAddr) {
            if (rAddr == address(0)) return false;
            try IResolver(rAddr).addr(eid.ensNode) returns (address resolved) {
                return resolved == expectedAddress;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    /**
     * @notice Read a text record from ENS (L1 only).
     */
    function readENSTextRecord(
        string calldata agentId,
        string calldata key
    ) external view returns (string memory) {
        bytes32 agentKey = _key(agentId);
        ENSIdentity storage eid = _ensIdentities[agentKey];
        if (bytes(eid.ensName).length == 0) return "";

        try IENS(ENS_REGISTRY).resolver(eid.ensNode) returns (address rAddr) {
            if (rAddr == address(0)) return "";
            try IResolver(rAddr).text(eid.ensNode, key) returns (string memory v) {
                return v;
            } catch { return ""; }
        } catch { return ""; }
    }

    // _key is inherited from GuardMeshRegistry (virtual)
}
