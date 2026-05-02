// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GuardMeshRegistry
 * @notice Agent identity and policy store for the GuardMesh decentralized AI firewall.
 *         Deployed on 0G Chain (EVM-compatible, Cancun-Deneb).
 *
 * @dev Stores per-agent policies: role scope, allowed/denied actions, and
 *      consensus threshold. Guardians query this at runtime via 0G KV Store
 *      or direct on-chain reads. Policies written here are the source of truth
 *      for every guardian evaluation.
 */
contract GuardMeshRegistry {

    // ─────────────────────────────────────────────────────────────────────────
    // Data Structures
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Consensus threshold options:
    ///      1 = Any 1 guardian approves  → action allowed
    ///      2 = Majority (2/3) approve   → action allowed  (default)
    ///      3 = Unanimous (3/3) approve  → action allowed
    uint8 public constant THRESHOLD_ANY        = 1;
    uint8 public constant THRESHOLD_MAJORITY   = 2;
    uint8 public constant THRESHOLD_UNANIMOUS  = 3;

    struct Policy {
        string   agentId;
        string   roleScope;            // e.g. "code_analysis_only"
        string[] allowedActions;       // e.g. ["read_file", "query_db"]
        string[] deniedActions;        // explicit blocklist e.g. ["forum_post", "change_permissions"]
        string[] allowedDataSources;   // tables/APIs the agent may touch
        uint8    consensusThreshold;   // 1 | 2 | 3
        address  owner;                // wallet that registered this agent
        uint256  registeredAt;         // block.timestamp at registration
        uint256  updatedAt;            // block.timestamp of last policy change
        bool     active;               // false = deactivated / suspended
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// agentId hash  →  Policy
    mapping(bytes32 => Policy) private _policies;

    /// agentId hash  →  exists?
    mapping(bytes32 => bool) private _registered;

    /// owner address →  list of agentId hashes owned
    mapping(address => bytes32[]) private _ownerAgents;

    /// flat list of all registered agentId hashes (for enumeration)
    bytes32[] private _allAgentKeys;

    /// plain agentId hash → agentId string (needed for enumeration)
    mapping(bytes32 => string) private _keyToId;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AgentRegistered(
        string  indexed agentId,
        address indexed owner,
        string          roleScope,
        uint256         timestamp
    );

    event PolicyUpdated(
        string  indexed agentId,
        address indexed updatedBy,
        uint256         timestamp
    );

    event AgentDeactivated(
        string  indexed agentId,
        address indexed owner,
        uint256         timestamp
    );

    event AgentReactivated(
        string  indexed agentId,
        address indexed owner,
        uint256         timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyAgentOwner(string memory agentId) {
        bytes32 key = _key(agentId);
        require(_registered[key], "GuardMesh: Agent not registered");
        require(_policies[key].owner == msg.sender, "GuardMesh: Not agent owner");
        _;
    }

    modifier agentExists(string memory agentId) {
        require(_registered[_key(agentId)], "GuardMesh: Agent not registered");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Write Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new agent with its identity and initial policy.
     * @param agentId        Unique agent identifier (e.g. "eng-assistant-04")
     * @param roleScope      What this agent is allowed to do (e.g. "code_analysis_only")
     * @param allowedActions Initial list of permitted action types
     */
    function registerAgent(
        string calldata   agentId,
        string calldata   roleScope,
        string[] calldata allowedActions
    ) external {
        require(bytes(agentId).length > 0,   "GuardMesh: Empty agent ID");
        require(bytes(roleScope).length > 0,  "GuardMesh: Empty role scope");

        bytes32 key = _key(agentId);
        require(!_registered[key], "GuardMesh: Agent already registered");

        _policies[key] = Policy({
            agentId:            agentId,
            roleScope:          roleScope,
            allowedActions:     allowedActions,
            deniedActions:      new string[](0),
            allowedDataSources: new string[](0),
            consensusThreshold: THRESHOLD_MAJORITY, // safe default
            owner:              msg.sender,
            registeredAt:       block.timestamp,
            updatedAt:          block.timestamp,
            active:             true
        });

        _registered[key]  = true;
        _keyToId[key]     = agentId;
        _allAgentKeys.push(key);
        _ownerAgents[msg.sender].push(key);

        emit AgentRegistered(agentId, msg.sender, roleScope, block.timestamp);
    }

    /**
     * @notice Update an agent's full policy (allowed actions, denied actions,
     *         consensus threshold). Only callable by the agent owner.
     * @param agentId            Target agent
     * @param allowedActions     New allowed action list
     * @param deniedActions      Explicit blocklist (e.g. "forum_post")
     * @param allowedDataSources Tables / APIs this agent may touch
     * @param consensusThreshold 1=Any1 | 2=Majority | 3=Unanimous
     */
    function updatePolicy(
        string    calldata agentId,
        string[]  calldata allowedActions,
        string[]  calldata deniedActions,
        string[]  calldata allowedDataSources,
        uint8              consensusThreshold
    ) external onlyAgentOwner(agentId) {
        require(
            consensusThreshold >= THRESHOLD_ANY &&
            consensusThreshold <= THRESHOLD_UNANIMOUS,
            "GuardMesh: Invalid threshold (1=Any1, 2=Majority, 3=Unanimous)"
        );

        bytes32 key = _key(agentId);
        Policy storage p = _policies[key];

        p.allowedActions     = allowedActions;
        p.deniedActions      = deniedActions;
        p.allowedDataSources = allowedDataSources;
        p.consensusThreshold = consensusThreshold;
        p.updatedAt          = block.timestamp;

        emit PolicyUpdated(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Update only the role scope of an agent.
     */
    function updateRoleScope(
        string calldata agentId,
        string calldata roleScope
    ) external onlyAgentOwner(agentId) {
        require(bytes(roleScope).length > 0, "GuardMesh: Empty role scope");
        bytes32 key = _key(agentId);
        _policies[key].roleScope  = roleScope;
        _policies[key].updatedAt  = block.timestamp;
        emit PolicyUpdated(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Deactivate an agent — guardians will hard-block all intents.
     */
    function deactivateAgent(string calldata agentId)
        external
        onlyAgentOwner(agentId)
    {
        bytes32 key = _key(agentId);
        _policies[key].active    = false;
        _policies[key].updatedAt = block.timestamp;
        emit AgentDeactivated(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Re-activate a previously deactivated agent.
     */
    function reactivateAgent(string calldata agentId)
        external
        onlyAgentOwner(agentId)
    {
        bytes32 key = _key(agentId);
        _policies[key].active    = true;
        _policies[key].updatedAt = block.timestamp;
        emit AgentReactivated(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer ownership of an agent's policy to a new address.
     */
    function transferAgentOwnership(
        string  calldata agentId,
        address          newOwner
    ) external onlyAgentOwner(agentId) {
        require(newOwner != address(0), "GuardMesh: Zero address");
        bytes32 key = _key(agentId);
        _policies[key].owner     = newOwner;
        _policies[key].updatedAt = block.timestamp;
        _ownerAgents[newOwner].push(key);
        emit PolicyUpdated(agentId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Get the full policy for an agent. Used by guardians at evaluation time.
     */
    function getPolicy(string calldata agentId)
        external
        view
        agentExists(agentId)
        returns (Policy memory)
    {
        return _policies[_key(agentId)];
    }

    /// @notice Check if an agent is registered.
    function isRegistered(string calldata agentId) external view returns (bool) {
        return _registered[_key(agentId)];
    }

    /// @notice Check if an agent is registered AND active.
    function isActive(string calldata agentId) external view returns (bool) {
        bytes32 key = _key(agentId);
        return _registered[key] && _policies[key].active;
    }

    /// @notice Total number of registered agents.
    function getAgentCount() external view returns (uint256) {
        return _allAgentKeys.length;
    }

    /// @notice Return all agentIds registered by a given owner wallet.
    function getOwnerAgents(address owner)
        external
        view
        returns (string[] memory agentIds)
    {
        bytes32[] storage keys = _ownerAgents[owner];
        agentIds = new string[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            agentIds[i] = _keyToId[keys[i]];
        }
    }

    /**
     * @notice Paginated enumeration of all agents (for dashboard).
     * @param offset  Start index
     * @param limit   Max results to return
     */
    function getAllAgentsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (Policy[] memory page, uint256 total)
    {
        total = _allAgentKeys.length;
        if (offset >= total) return (new Policy[](0), total);

        uint256 end   = offset + limit > total ? total : offset + limit;
        uint256 count = end - offset;
        page = new Policy[](count);

        for (uint256 i = 0; i < count; i++) {
            page[i] = _policies[_allAgentKeys[offset + i]];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _key(string memory agentId) internal pure virtual returns (bytes32) {
        return keccak256(abi.encodePacked(agentId));
    }
}
