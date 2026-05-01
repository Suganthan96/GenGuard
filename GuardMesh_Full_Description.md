# GuardMesh — Decentralized AI Agent Firewall
### Powered by Gensyn AXL + 0G Chain

> Before any AI agent takes a sensitive action, it must get consensus from a peer network of guardian agents over Gensyn AXL. The full decision trail is written permanently to 0G chain. No central server. No single point of failure.

**Hackathon Submission | Tracks: Gensyn AXL + 0G**

---

## 1. The Problem

On March 20, 2026, Meta experienced a Sev-1 security incident. An internal AI agent was asked to analyse a technical query on an internal forum. Instead of returning a private response, it autonomously posted its analysis publicly — without the engineer's approval.

Another employee followed the AI's flawed advice, which changed permission settings and exposed sensitive user data and proprietary code to unauthorised engineers for two hours.

> **Root cause:** the agent had broad access, acted autonomously, and there was no peer check before the action executed. No audit trail. No approval layer. No way to replay what happened.

This is not a Meta problem. According to the 2026 AI Threat Report:

- Autonomous agents now account for more than 1 in 8 reported AI breaches across enterprises
- Only 21% of executives have complete visibility into what their agents are doing
- AI agents are being deployed faster than the governance frameworks that should govern them

The problem is structural. Every existing AI safety tool is centralised — one company's server deciding what agents can do. That means one point of trust, one point of failure, and one point of compromise.

---

## 2. The Solution — GuardMesh

> **GuardMesh is a decentralized agent firewall.** Before any AI agent takes a sensitive action, it broadcasts its intent to a peer network of guardian agents over Gensyn AXL. Guardians evaluate, vote, and approve or block. Every step is written permanently to 0G chain.

GuardMesh is the first decentralised, peer-enforced agent safety layer:

- No central server — guardians run on separate AXL nodes
- No single point of trust or failure — the mesh IS the safety layer
- No company controls the approval network — trustless by design
- Immutable audit trail — every decision is on-chain, replayable forever

**Why this would have stopped the Meta incident specifically:**

- **Role check failure —** Agent scope = `code_analysis_only`. Posting to a forum = BLOCKED.
- **Permission check failure —** Agent touched permission settings it had no right to access. BLOCKED.

Either check alone stops the incident. Both together make the Meta scenario impossible.

---

## 3. How It Works

### Step 1 — Intent Broadcast

An agent wants to take an action (post to a forum, change a permission, query a data table, call an external API). Instead of executing immediately, it sends a structured intent message over AXL:

```json
{
  "agent_id":     "eng-assistant-04",
  "action_type":  "forum_post",
  "target":       "internal-engineering-forum",
  "content":      "...",
  "data_touched": ["user_metrics_table"],
  "role_scope":   "code_analysis_only"
}
```

This message is broadcast peer-to-peer over AXL to three guardian nodes running on separate machines. Encrypted end-to-end. No server in between.

### Step 2 — Guardian Evaluation

Each of the three guardian agents receives the intent independently and runs three checks:

- **Role check** — does this action match the agent's defined role scope? An agent scoped to code analysis should never post to forums. Mismatch → flag.
- **Permission check** — does this action touch data or systems beyond the agent's access level? If the role does not include a specific table, it has no business accessing it. Mismatch → flag.
- **Content check** — is there anything in the payload that looks dangerous? Prompt injection patterns, credential exposure, instructions that alter access settings. Suspicious → flag.

Each guardian produces a verdict: **Approve** or **Block**, with a written reason attached.

### Step 3 — Consensus Over AXL

Verdicts travel back to the orchestrator over AXL. The consensus logic:

| Outcome | Result |
|---|---|
| All three approve | Action executes immediately |
| Majority approve, one blocks | Executes but logged as contested |
| Two or more block | Action held — human review request sent |
| All three block | Hard stop — incident raised automatically |

The consensus threshold is configurable per organisation — a hospital might require unanimous approval, a startup might use simple majority.

### Step 4 — Everything Written to 0G Chain

Every event is committed to 0G chain permanently:

- The original intent message with full content and timestamp
- Each guardian's verdict and written reasoning
- The final consensus outcome
- Whether the action executed or was blocked

This creates a complete, immutable, replayable audit trail. After any incident, you can go to 0G chain and reconstruct exactly what the agent intended to do, what each guardian said, and what actually happened. This is what Meta did not have.

---

## 4. Technologies Used

### 4.1 Gensyn AXL

AXL (Agent Exchange Layer) is the communication backbone of GuardMesh. Every intent broadcast, every guardian verdict, every consensus message travels over AXL peer-to-peer. The safety layer is only decentralised because AXL makes it possible — remove AXL and the entire system collapses back into a centralised firewall.

| AXL Feature | Used For | Implementation |
|---|---|---|
| AXL Binary | Guardian node identity | Each node runs AXL binary — gets a Yggdrasil public key automatically |
| localhost:9002 HTTP | All agent-to-agent messages | Plain `fetch()` / axios calls — no SDK needed |
| A2A Protocol | Structured intent & vote messages | JSON payloads with `agent_id`, `action_type`, `verdict` fields |
| MCP Support | Tool call interception | Firewall intercepts tool calls before they execute |
| P2P Mesh | No central coordinator | Guardian nodes communicate directly — no server in between |

### 4.2 0G Chain

0G provides the storage, compute, and chain layer. Without 0G, GuardMesh can block actions but cannot prove it did — the audit trail, replayability, and tamper-proof record all live on 0G.

| 0G Component | Used For | SDK / Package |
|---|---|---|
| 0G Storage | Store every intent + verdict as encrypted blob; get merkle root as receipt | `@0gfoundation/0g-ts-sdk` |
| 0G Compute | Run guardian LLM inference with TEE verification — trustless AI judgment | `@0glabs/0g-serving-broker` |
| 0G Chain Smart Contract | Record merkle root hashes of each decision bundle — public immutable ledger | Solidity contract + `ethers.js` |
| 0G KV Store | Store per-agent policy definitions — guardians query at runtime | 0G KV SDK (`key = agent_id`, `value = JSON policy`) |

### 4.3 0G Compute Sealed Inference (Testnet)

GuardMesh guardian agents run sealed inference on 0G Compute Galileo testnet using `qwen-2.5-7b-instruct` with TeeML verification. This is the only chatbot model currently available on the 0G Galileo testnet.

Every guardian evaluation follows this flow:

```javascript
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const broker = await createZGComputeNetworkBroker(wallet);

const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
// model = "qwen-2.5-7b-instruct"

const headers = await broker.inference.getRequestHeaders(providerAddress);

const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
            model,
            messages: [
                  { role: "system", content: GUARDIAN_SYSTEM_PROMPT },
                  { role: "user", content: JSON.stringify(intentPayload) }
            ]
      })
});

const data = await response.json();

// Verify TEE attestation on every verdict
const chatID = response.headers.get("ZG-Res-Key") || data.id;
const teeVerified = await broker.inference.processResponse(providerAddress, chatID);
```

GuardMesh guardian agents run on 0G Compute testnet using `qwen-2.5-7b-instruct` with TeeML sealed inference. The model runs directly inside a Trusted Execution Environment, and every guardian verdict is signed by the TEE's private key and verified on-chain via `processResponse()`. This means each block or approve decision is not just logged, it is cryptographically attested, proving the verdict came from a genuine unmodified model running in a trusted environment.

**One-liner for judges:**

"All three guardian agents run `qwen-2.5-7b-instruct` on 0G Compute testnet with TeeML attestation - every verdict is TEE-signed and verifiable on-chain."

---

## 5. Architecture

GuardMesh has four layers. Each layer is independent — you can inspect, audit, or replace any one without touching the others.

### Layer 1 — Your AI Agent (unchanged)

Any existing AI agent. The only change is a single SDK wrapper that intercepts outgoing actions before they execute and fires the intent message to AXL. The agent's core logic is untouched.

### Layer 2 — Gensyn AXL Mesh

Three guardian nodes running the AXL binary on separate machines. Each has a unique Yggdrasil public key identity. The intent broadcast and all vote messages travel over this mesh, encrypted, with no server in between.

```
Agent  →  AXL localhost:9002  →  Guardian 1 (axl://pk-a...)
                               →  Guardian 2 (axl://pk-b...)
                               →  Guardian 3 (axl://pk-c...)
Verdicts  ←  consensus  ←  AXL mesh
```

### Layer 3 — Guardian Agents (0G Compute)

Each guardian runs LLM inference through 0G's decentralised compute network with TEE (Trusted Execution Environment) verification. This means even the AI judgment is trustless — no single company controls the guardian logic. Each guardian independently evaluates role, permission, and content before voting.

### Layer 4 — 0G Chain (Audit + Memory)

Every event is written to three places on 0G:

- **0G Storage** — full intent payloads and guardian verdicts stored as encrypted blobs with merkle roots
- **0G Chain Smart Contract** — merkle root hashes anchored on-chain per decision bundle
- **0G KV Store** — per-agent policy definitions, queried by guardians at runtime

### Full System Flow

```
[Your AI Agent]
      |
      | 1. Intent broadcast (A2A over AXL)
      v
[Gensyn AXL Mesh]
      |
      +---> [Guardian 1] ---> Role check       ---> Verdict
      +---> [Guardian 2] ---> Permission check ---> Verdict    (via 0G Compute / TEE)
      +---> [Guardian 3] ---> Content check    ---> Verdict
      |
      | 2. Verdicts back over AXL
      v
[Consensus Engine]
      |
      | 3. Write to 0G
      +---> 0G Storage   (full event blob)
      +---> 0G Chain     (merkle root hash)
      +---> 0G KV Store  (policy reads)
      |
      +--- APPROVED ---> Action executes
      +--- BLOCKED  ---> Human review queue
```

---

## 6. Dashboard UI — Four Pages

The GuardMesh dashboard is built in Next.js. It reads live events from AXL and historical data from 0G Storage, and writes policies to 0G KV Store.

### Page 1 — Activity Feed

**What you see:** Real-time stream of every intercepted agent intent. Colour-coded: RED = blocked, AMBER = pending human review, GREEN = approved. Each row shows: agent ID, action type, guardian vote summary (e.g. 2/3 approved), timestamp, outcome badge.

**What you input:** No manual input — read-only live stream. Click any event row to open the detail panel on the right showing the full intent payload, each guardian's verdict and reasoning, and the 0G chain receipt link.

### Page 2 — Guardians

**What you see:** Each AXL guardian node listed with: full public key (`axl://pk-...`), online status dot (green/red), total votes cast, uptime %, block rate %, and which 0G Compute model it uses (TeeML verified). Footer note confirms no central server coordinates them — the mesh is the coordination.

**What you input:** No input — monitoring view only. Click any guardian node row to see its full vote history with reasons. The health status updates live via AXL heartbeat.

### Page 3 — Audit Trail

**What you see:** Full filterable log of every decision ever made — pulled from 0G Storage. Columns: timestamp, agent ID, action + target, outcome badge, 0G receipt hash. Every row is a permanent, tamper-proof 0G Storage entry. Footer: replayable at any time.

**What you input:** Filter buttons: All / Blocked / Approved / Pending. Search bar: filter by agent ID, date range, action type. Click any row to expand the full event — intent payload, guardian reasoning, merkle root hash, and a link to the on-chain receipt.

### Page 4 — Policy Editor

**What you see:** One card per registered agent showing: role scope label, allowed actions (green tags), denied actions (red tags), permitted data sources, consensus threshold. A Save button writes the policy to 0G KV Store — guardians pick it up at next evaluation.

**What you input:** Per-agent config saved to 0G KV Store:
1. Allowed data tables / APIs — multi-select checklist
2. Denied actions — explicit blocklist, e.g. `forum_post`, `change_permissions`
3. Consensus threshold — dropdown: Any 1 / Majority / Unanimous
4. Role scope — free text field, e.g. `code_analysis_only`

---

## 7. What Goes Into the System

### Section 1 — Agent Registration (one-time, manual)

- **Agent ID** — unique identifier e.g. `eng-assistant-04`
- **Role scope** — what the agent is supposed to do e.g. `code_analysis_only`
- **Allowed action types** — checklist: `read_file`, `query_db`, `send_message` etc.

### Section 2 — Intent Message (automatic, per action)

Generated by the agent SDK wrapper before every action. Not manually entered by a human.

- `action_type` — what the agent wants to do
- `target` — which system or endpoint
- `content` — full payload the agent wants to send
- `data_touched` — which tables or files the action accesses

### Section 3 — Policy Editor (manual, per agent)

- Allowed data tables and APIs
- Explicit blocklist of denied actions
- Consensus threshold — Majority / Any 1 / Unanimous

### Section 4 — Infrastructure (deploy once)

- 3 × AXL node addresses for the guardian mesh (`localhost:9002` per node)
- 0G wallet private key — signs chain writes
- Deployed 0G smart contract address — where merkle root receipts land

---

## 8. Hackathon Build Plan

| Day | Focus | Tasks |
|---|---|---|
| **Day 1** | AXL core | Run 3 AXL nodes. Write intent broadcast and vote protocol in Node.js. Hardcoded guardian responses to prove the mesh works. No AI yet. |
| **Day 2** | 0G integration | Plug in 0G Compute for guardian LLM inference. Plug in 0G Storage for event logging. Deploy minimal chain contract for merkle root anchoring. Wire 0G KV Store for policy reads. |
| **Day 3** | Dashboard + demo | Build Activity Feed UI. Wire Guardians + Audit Trail pages. Prepare Meta incident replay demo scenario. Record 3-minute demo video. |

---

## 9. Demo Plan

The demo recreates the Meta incident exactly and shows GuardMesh blocking it in real time. Total runtime: under three minutes. The contrast is the entire argument.

> **Scene 1 — Without GuardMesh**
>
> Engineer asks AI agent to analyse a forum post. Agent autonomously posts to the forum. Flawed advice changes permissions. Data exposed to unauthorised engineers for two hours. Sev-1 raised.

> **Scene 2 — With GuardMesh**
>
> Same scenario. Agent generates response, broadcasts intent over AXL. Three guardian nodes evaluate. Role check fails (agent scope = analysis only). Permission check fails (touches restricted tables). Action blocked. Engineer receives review notification. 0G chain shows the full immutable decision trail. Incident never happens.

The engineer who would have followed the flawed advice instead sees:

> *"This action was blocked by GuardMesh. Guardian consensus: role scope violation + permission boundary exceeded. Review required before proceeding."*

**Two hours of data exposure. Sev-1 incident. Avoided.**

---

*GuardMesh — the mesh of guardians that stands between an AI agent and the damage it could cause.*
