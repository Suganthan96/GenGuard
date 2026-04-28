// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GuardMeshAudit
 * @notice Immutable decision ledger for the GuardMesh decentralized AI firewall.
 *         Deployed on 0G Chain (EVM-compatible, Cancun-Deneb).
 *
 * @dev Records the merkle root hash of every decision bundle written to
 *      0G Storage (intent payload + guardian verdicts + consensus outcome).
 *      Anyone can verify any decision by querying its merkle root.
 *      The full event blob lives in 0G Storage; this contract is the
 *      tamper-proof index and receipt layer — the on-chain proof that
 *      a decision happened and what its outcome was.
 */
contract GuardMeshAudit {

    // ─────────────────────────────────────────────────────────────────────────
    // Data Structures
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Outcome codes for dashboard colour-coding.
    uint8 public constant OUTCOME_APPROVED  = 1;
    uint8 public constant OUTCOME_BLOCKED   = 2;
    uint8 public constant OUTCOME_CONTESTED = 3; // majority approved, one blocked
    uint8 public constant OUTCOME_PENDING   = 4; // human review required

    struct Decision {
        string   agentId;           // e.g. "eng-assistant-04"
        bytes32  merkleRoot;        // root of (intent + verdicts) stored in 0G Storage
        bool     approved;          // final consensus result
        uint8    outcome;           // OUTCOME_* constant for UI
        string   actionType;        // e.g. "forum_post", "change_permissions"
        string   target;            // e.g. "internal-engineering-forum"
        uint8    approveCount;      // how many guardians approved (0-3)
        uint8    blockCount;        // how many guardians blocked  (0-3)
        string   blockedReason;     // aggregated reason if blocked/contested
        uint256  intentTimestamp;   // when the intent was originally broadcast (off-chain time)
        uint256  recordedAt;        // block.timestamp when anchored on-chain
        address  recorder;          // consensus engine address that submitted
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// merkleRoot → Decision
    mapping(bytes32 => Decision) private _decisions;

    /// agentId hash → ordered list of merkle roots (chronological)
    mapping(bytes32 => bytes32[]) private _agentHistory;

    /// flat global list of all merkle roots (for pagination)
    bytes32[] private _allRoots;

    /// Addresses authorised to call recordDecision (the consensus engines)
    mapping(address => bool) public authorizedRecorders;

    /// Contract admin (deployer by default, transferable)
    address public admin;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event DecisionRecorded(
        string  indexed agentId,
        bytes32 indexed merkleRoot,
        bool            approved,
        uint8           outcome,
        string          actionType,
        uint256         intentTimestamp,
        address         recorder
    );

    event RecorderAuthorized(address indexed recorder, uint256 timestamp);
    event RecorderRevoked   (address indexed recorder, uint256 timestamp);
    event AdminTransferred  (address indexed oldAdmin,  address indexed newAdmin);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "GuardMesh: Not admin");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedRecorders[msg.sender] || msg.sender == admin,
            "GuardMesh: Not authorized recorder"
        );
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
        authorizedRecorders[msg.sender] = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Authorise a consensus engine address to write decisions.
     *         Call this after deploying each consensus engine instance.
     */
    function authorizeRecorder(address recorder) external onlyAdmin {
        require(recorder != address(0), "GuardMesh: Zero address");
        authorizedRecorders[recorder] = true;
        emit RecorderAuthorized(recorder, block.timestamp);
    }

    /**
     * @notice Revoke a recorder's write access (e.g. compromised key).
     */
    function revokeRecorder(address recorder) external onlyAdmin {
        authorizedRecorders[recorder] = false;
        emit RecorderRevoked(recorder, block.timestamp);
    }

    /**
     * @notice Transfer admin rights to a new address.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "GuardMesh: Zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core Write Function
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Anchor a GuardMesh decision on-chain.
     *         Only callable by an authorised consensus engine.
     *
     * @param agentId           The agent that generated the intent
     * @param merkleRoot        Merkle root of the full decision bundle in 0G Storage
     * @param approved          True if the consensus outcome allows the action
     * @param outcome           OUTCOME_APPROVED | BLOCKED | CONTESTED | PENDING
     * @param actionType        What the agent wanted to do ("forum_post", etc.)
     * @param target            Target system or endpoint
     * @param approveCount      Guardian votes in favour (0-3)
     * @param blockCount        Guardian votes against  (0-3)
     * @param blockedReason     Aggregated guardian reason (empty if approved)
     * @param intentTimestamp   Off-chain timestamp of the original intent broadcast
     */
    function recordDecision(
        string  calldata agentId,
        bytes32          merkleRoot,
        bool             approved,
        uint8            outcome,
        string  calldata actionType,
        string  calldata target,
        uint8            approveCount,
        uint8            blockCount,
        string  calldata blockedReason,
        uint256          intentTimestamp
    ) external onlyAuthorized {
        require(merkleRoot != bytes32(0),               "GuardMesh: Invalid merkle root");
        require(_decisions[merkleRoot].recordedAt == 0, "GuardMesh: Decision already recorded");
        require(bytes(agentId).length > 0,              "GuardMesh: Empty agent ID");
        require(approveCount + blockCount <= 3,         "GuardMesh: Vote count exceeds guardian total");
        require(
            outcome == OUTCOME_APPROVED  ||
            outcome == OUTCOME_BLOCKED   ||
            outcome == OUTCOME_CONTESTED ||
            outcome == OUTCOME_PENDING,
            "GuardMesh: Invalid outcome code"
        );

        _decisions[merkleRoot] = Decision({
            agentId:          agentId,
            merkleRoot:       merkleRoot,
            approved:         approved,
            outcome:          outcome,
            actionType:       actionType,
            target:           target,
            approveCount:     approveCount,
            blockCount:       blockCount,
            blockedReason:    blockedReason,
            intentTimestamp:  intentTimestamp,
            recordedAt:       block.timestamp,
            recorder:         msg.sender
        });

        bytes32 agentKey = keccak256(abi.encodePacked(agentId));
        _agentHistory[agentKey].push(merkleRoot);
        _allRoots.push(merkleRoot);

        emit DecisionRecorded(
            agentId,
            merkleRoot,
            approved,
            outcome,
            actionType,
            intentTimestamp,
            msg.sender
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve a single decision by its merkle root hash.
     *         This is the primary verification function — any auditor can call this.
     */
    function getDecision(bytes32 merkleRoot)
        external
        view
        returns (Decision memory)
    {
        require(_decisions[merkleRoot].recordedAt != 0, "GuardMesh: Decision not found");
        return _decisions[merkleRoot];
    }

    /**
     * @notice Return the full decision history for a given agent.
     *         WARNING: unbounded — use paginated version for large histories.
     */
    function getAgentHistory(string calldata agentId)
        external
        view
        returns (Decision[] memory history)
    {
        bytes32   agentKey = keccak256(abi.encodePacked(agentId));
        bytes32[] storage roots = _agentHistory[agentKey];

        history = new Decision[](roots.length);
        for (uint256 i = 0; i < roots.length; i++) {
            history[i] = _decisions[roots[i]];
        }
    }

    /**
     * @notice Paginated agent history — use this for the Audit Trail dashboard page.
     * @param agentId  Target agent
     * @param offset   Start index (0-based)
     * @param limit    Max results per page
     * @return page    Slice of Decision structs
     * @return total   Total decisions recorded for this agent
     */
    function getAgentHistoryPaginated(
        string calldata agentId,
        uint256         offset,
        uint256         limit
    ) external view returns (Decision[] memory page, uint256 total) {
        bytes32   agentKey = keccak256(abi.encodePacked(agentId));
        bytes32[] storage roots = _agentHistory[agentKey];
        total = roots.length;

        if (offset >= total) return (new Decision[](0), total);

        uint256 end   = offset + limit > total ? total : offset + limit;
        uint256 count = end - offset;
        page = new Decision[](count);

        for (uint256 i = 0; i < count; i++) {
            page[i] = _decisions[roots[offset + i]];
        }
    }

    /**
     * @notice Paginated global audit trail — for the full Audit Trail dashboard view.
     * @param offset  Start index
     * @param limit   Max results
     * @return page   Slice of Decision structs
     * @return total  Total decisions ever recorded
     */
    function getAllDecisionsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (Decision[] memory page, uint256 total)
    {
        total = _allRoots.length;
        if (offset >= total) return (new Decision[](0), total);

        uint256 end   = offset + limit > total ? total : offset + limit;
        uint256 count = end - offset;
        page = new Decision[](count);

        for (uint256 i = 0; i < count; i++) {
            page[i] = _decisions[_allRoots[offset + i]];
        }
    }

    /**
     * @notice Check if a decision with this merkle root has been recorded.
     *         Useful for light-weight verification without fetching the full struct.
     */
    function decisionExists(bytes32 merkleRoot) external view returns (bool) {
        return _decisions[merkleRoot].recordedAt != 0;
    }

    /// @notice Total decisions ever anchored on-chain.
    function getTotalDecisions() external view returns (uint256) {
        return _allRoots.length;
    }

    /// @notice Total decisions recorded for a specific agent.
    function getAgentDecisionCount(string calldata agentId)
        external
        view
        returns (uint256)
    {
        return _agentHistory[keccak256(abi.encodePacked(agentId))].length;
    }

    /**
     * @notice Verify that a given merkle root is recorded on-chain and matches
     *         the expected outcome. Used by auditors / compliance tools.
     * @return exists    True if the root is on-chain
     * @return approved  The recorded approval outcome
     * @return outcome   The specific outcome code
     * @return timestamp When the decision was anchored
     */
    function verifyDecision(bytes32 merkleRoot)
        external
        view
        returns (
            bool    exists,
            bool    approved,
            uint8   outcome,
            uint256 timestamp
        )
    {
        Decision storage d = _decisions[merkleRoot];
        if (d.recordedAt == 0) return (false, false, 0, 0);
        return (true, d.approved, d.outcome, d.recordedAt);
    }
}
