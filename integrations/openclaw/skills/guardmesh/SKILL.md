---
name: guardmesh
description: Register-aligned workflow — OpenClaw gathers stats, then GuardMesh intent + 3 guardians enforce on-chain allowedActions before dangerous tools.
metadata:
  openclaw:
    requires:
      env:
        - GUARDMESH_BRIDGE_SCRIPT
---

# GuardMesh + OpenClaw (policy → stats → intent → mesh)

Official OpenClaw references: [Gateway runbook](https://docs.openclaw.ai/gateway/index.md), [Tools and plugins](https://docs.openclaw.ai/tools/index.md), [Tools invoke HTTP](https://docs.openclaw.ai/gateway/tools-invoke-http-api.md), [Tools config](https://docs.openclaw.ai/gateway/config-tools.md).

## 1) Register the agent (human, once)

On **GenGuard → Policy editor** (`/home/policies`), register the **same** `agent_id` you will put in intents. Set **allowed actions** to the exact capability tokens you want enforced on-chain, for example:

`read_file, code_analysis, query_db`

Guardians **read `GuardMeshRegistry` on 0G** before calling 0G Compute. If the agent is missing, inactive, or `action_type` is not allowed (after alias normalization), the intent is **BLOCK**ed immediately — all three guardians still run independently, but the registry gate fails fast.

## 2) OpenClaw does the work (files / DB / analysis)

### Option A — GenGuard HTTP tools (recommended)

When **GenGuard `Web`** is running (`npm run dev` on port 3000), call these **after** guardians approve the matching `action_type` (or use them only for **stats gathering** before the intent, if your org allows reads without prior approval — default skill flow is **intent first** for anything sensitive).

Set **`GUARDMESH_TOOL_SECRET`** in `Web/.env.local` and send `Authorization: Bearer <secret>` on every request. Set **`GUARDMESH_WORKSPACE_ROOT`** to the repo root (or another directory) so `read_file` cannot escape that tree.

| Action (registry) | Method | Path |
|-------------------|--------|------|
| `read_file` | POST | `/api/guardmesh/run/read-file` |
| `code_analysis` | POST | `/api/guardmesh/run/code-analysis` |
| `query_db` | POST | `/api/guardmesh/run/query-db` |

**read_file** — body `{ "path": "…" }` (under `GUARDMESH_WORKSPACE_ROOT`). If `path` is a **file**: returns `kind: "file"`, `encoding: "utf8"` or `"base64"` for binary / invalid UTF-8, max ~2 MiB. If `path` is a **directory**: returns `kind: "directory"` and `entries` (name, `relativePath`, `kind`) up to 500 items.

**code_analysis** — `{ "policy": { "agentId", "roleScope", "allowedActions" }, "question?" }` plus at least one of:

- **`code`**: inline source string, and/or  
- **`path`** / **`paths`**: workspace files the **server** reads as UTF-8 text, merged into the analyst prompt (same sandbox as `read_file`).

Requires **`OPENAI_API_KEY`**. Binary or non–UTF-8 paths return **400** (use `read_file` for base64 instead).

**query_db** — read-only. Body `{ "operation": "listCollections" | "sample" | "aggregate", "collection?", "filter?", "limit?", "pipeline?" }`. Requires **`MONGODB_URI`** on the server. `aggregate` forbids `$out` / `$merge`; caps on stages and result size apply.

Example (PowerShell, after guardians approved `read_file`):

```powershell
$h = @{ "Authorization" = "Bearer $env:GUARDMESH_TOOL_SECRET"; "Content-Type" = "application/json" }
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/guardmesh/run/read-file" -Method POST -Headers $h -Body '{"path":"README.md"}'
```

### Option B — Local OpenClaw tools only

Use normal OpenClaw **`exec`** / editor tools to read files and your own DB CLIs. Collect a small **statistics object** (counters + short notes) for `openclaw_stats`.

## 3) Build `intent.json` then call the bridge

Fetch live policy (optional sanity check):

`GET http://127.0.0.1:3000/api/guardmesh/policy/<agentId>` (URL-encode the id if needed)

Build JSON for the bridge (wrap the intent object; optional mesh threshold):

```json
{
  "intent": {
    "agent_id": "eng-assistant-04",
    "action_type": "query_db",
    "target": "readonly_analytics_db",
    "content": "What you plan to do in plain language.",
    "data_touched": ["public.metrics_daily"],
    "role_scope": "code_analysis_only",
    "openclaw_stats": {
      "files_read": 2,
      "db_queries": 1,
      "code_analysis_runs": 1,
      "notes": "All reads were allowlisted tables only."
    }
  },
  "consensus_threshold": "phase5"
}
```

**`consensus_threshold`** (optional; same as GenGuard env `GUARDMESH_CONSENSUS_THRESHOLD`): `phase5` (default mesh table for 3 guardians), `unanimous` (all must APPROVE), `majority` (strict majority APPROVE), `any` (≥1 APPROVE and not all BLOCK). Numeric aliases `1` / `2` / `3` match on-chain `THRESHOLD` codes (ANY / MAJORITY / UNANIMOUS).

Rules:

- `action_type` must match **allowedActions** on-chain, or an accepted **alias** (`db_analysis` → `query_db`).
- `role_scope` on the intent must match the chain policy if you include it (mismatch → BLOCK).

Run (PowerShell):

```text
node $env:GUARDMESH_BRIDGE_SCRIPT intent.json --strict-consensus
```

- **`--strict-consensus`** — exit non-zero unless **`consensus.execute`** is **true**. **Preferred** over legacy **`--strict`** (any APPROVE in `verdicts[]`).
- **`--strict-final`** — exit non-zero unless **`consensus.finalDecision.action`** is **`execute`** or **`execute_contested`**. Use this when the model should only continue if the API’s **primary-agent instruction** is explicitly “go”.

After the bridge runs, **stderr** repeats **`finalDecision`** so `exec` logs stay readable even when stdout is huge JSON:

- Read **`consensus.finalDecision.agentInstruction`** and treat it as the **single sentence** the assistant must follow before calling further tools (execute / hold / block wording is authoritative for the org).

## 4) Only if guardians approve

Use **`consensus.finalDecision`**: if **`action`** is **`execute`** or **`execute_contested`**, you may proceed with the side-effect tool (per org rules on contested). If **`hold`**, **`block`**, or **`insufficient_quorum`**, stop and explain using **`agentInstruction`**. **`consensus.execute`** stays in sync for automation scripts.

### Optional: mesh then Gateway `POST /tools/invoke`

For a **single scripted** path (automation, not the in-model `exec` flow), use repo script **`mesh-then-openclaw-invoke.mjs`** with a plan JSON that includes **`"invoke": { "tool", "args", … }`** and env **`OPENCLAW_GATEWAY_TOKEN`**. See `integrations/openclaw/README.md` and `examples/mesh-then-invoke.example.json`.

## Environment

| Variable | Purpose |
|----------|---------|
| `GUARDMESH_BRIDGE_SCRIPT` | Path to `guardmesh-bridge.mjs` |
| `GUARDMESH_BRIDGE_URL` | Optional; default `http://127.0.0.1:3000/api/guardmesh/intent` |
| `GUARDMESH_CONSENSUS_THRESHOLD` | On **GenGuard `Web` server**: default mesh rule (`phase5`, `unanimous`, `majority`, `any`). Overridable per request with JSON **`consensus_threshold`**. |

