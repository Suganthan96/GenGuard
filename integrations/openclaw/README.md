# OpenClaw × GuardMesh wiring

OpenClaw is the **Gateway + agent** (tools, channels, sessions). GuardMesh is the **policy + consensus** layer (intents over **AXL**, guardians, optional on-chain registry).

This folder adds a **small bridge** the Gateway host can run so OpenClaw’s agent can call your existing **`POST /api/guardmesh/intent`** route in `Web/`.

## How this maps to OpenClaw’s own docs

These upstream pages are the contracts this integration follows:

- **[Gateway runbook](https://docs.openclaw.ai/gateway/index.md)** — one always-on Gateway process; default port **18789** (`--port` / `OPENCLAW_GATEWAY_PORT` / `gateway.port`); loopback-first auth; `openclaw gateway status`, `openclaw doctor`, config hot reload.
- **[Tools and plugins](https://docs.openclaw.ai/tools/index.md)** — tools are what the agent invokes; **skills** (`SKILL.md`) teach when/how; **plugins** can register more. Global policy uses **`tools.allow` / `tools.deny`** (deny wins) and **`tools.profile`** (`coding`, `messaging`, `minimal`, `full`).
- **[Configuration — tools](https://docs.openclaw.ai/gateway/config-tools.md)** — tool groups (`group:fs`, `group:runtime`, …), **`tools.loopDetection`**, **`tools.exec`**, elevated mode, per-provider overrides.
- **[Tools invoke (HTTP)](https://docs.openclaw.ai/gateway/tools-invoke-http-api.md)** — **`POST {gateway}/tools/invoke`** with Gateway bearer auth; same tool-policy chain as in-chat agents. Treat as **operator** surface; keep on loopback/Tailnet. Several tools are **HTTP-denied by default** (including `exec`, `apply_patch`, …); use a safe tool (e.g. `sessions_list`) to verify wiring.
- **[Hooks](https://docs.openclaw.ai/automation/hooks.md)** — internal Gateway hooks (`command:new`, `message:received`, …). **Per–tool-call interception** (e.g. `before_tool_call`) lives in the **Plugin SDK**, not in a minimal `handler.ts` hook pack — see [plugin architecture internals](https://docs.openclaw.ai/plugins/architecture-internals.md).

Optional merge snippet for **`tools.loopDetection`**: `integrations/openclaw/openclaw.recommended-tools-fragment.json` (manually merge into `~/.openclaw/openclaw.json`).

## 1. Install OpenClaw (npm)

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw gateway status
openclaw dashboard
```

Use **Node 22.14+** (OpenClaw recommends **Node 24**). On Windows, **WSL2** is the most stable path; native Windows works but may need extra PATH fixes for global bins.

## 2. Run GenGuard + mesh (same machine as Gateway for localhost bridge)

From this monorepo:

1. `cd Web && npm run dev` — serves `http://127.0.0.1:3000` including `/api/guardmesh/intent` and **`GET /api/guardmesh/policy/{agentId}`** (read-only policy JSON for OpenClaw).

### GenGuard tool routes (`read_file`, `code_analysis`, `query_db`)

These mirror on-chain **`allowedActions`** tokens. They are **POST** JSON endpoints under:

- **`/api/guardmesh/run/read-file`** — sandboxed read: **file** (UTF-8 or base64) or **directory** listing (`GUARDMESH_WORKSPACE_ROOT`, default parent of `Web/`)
- **`/api/guardmesh/run/code-analysis`** — OpenAI analysis: `policy` + **`code` and/or `path` / `paths`** (server loads UTF-8 files under the same root), optional `question`. Add **`"persistForDashboard": true`** so the GenGuard **Agent analysis** page (`/home/analyze`) can poll **`GET /api/guardmesh/analysis/latest?agentId=…`** and show the same result (in-memory until dev server restart).
- **`/api/guardmesh/run/query-db`** — read-only Mongo (`MONGODB_URI`): `listCollections`, `sample`, or `aggregate` (no `$out` / `$merge`)

Optional **`GUARDMESH_TOOL_SECRET`**: when set, all three routes require `Authorization: Bearer <secret>`. Use this whenever the dev server is reachable beyond localhost.

Optional **`tools.loopDetection`** in OpenClaw config can damp repeated `exec` / bridge patterns ([config-tools](https://docs.openclaw.ai/gateway/config-tools.md)); a starter fragment is `openclaw.recommended-tools-fragment.json` in this folder.
2. Start **AXL** hub + spokes and **three** `guardmesh-guardian` listeners (`PHASE3_COMPLETE.md`).
3. **`Web/.env` or `Web/.env.local`**: copy from `Web/.env.example`. Set **`OPENAI_API_KEY`** for code analysis. For **OpenRouter** + e.g. **`qwen/qwen-2.5-7b-instruct`**, set **`OPENAI_API_BASE=https://openrouter.ai/api/v1`** and **`OPENAI_MODEL=qwen/qwen-2.5-7b-instruct`** (optional **`OPENROUTER_HTTP_REFERER`** / **`OPENROUTER_APP_TITLE`**). Set **`GUARDMESH_TOOL_SECRET`** if you want `POST /api/guardmesh/run/*` to require `Authorization: Bearer …` (same value for OpenClaw / `run-code-analysis.mjs`, which reads `Web/.env` or `Web/.env.local` automatically). Also set **`GUARDMESH_AXL_URL`**, optional **`GUARDMESH_GUARDIAN_PEER_IDS`**, same vars the intent API route already uses.
4. Each guardian `.env`: set **`GUARDMESH_REGISTRY_ADDRESS`** (default is baked into `guardian.js` for the deployed registry). Guardians now **query the registry first**: unknown agent, inactive agent, or `action_type` not in `allowedActions` → **BLOCK** before 0G Compute. Set **`GUARDMESH_REGISTRY_DISABLE=1`** only if you need LLM-only mode.

## 3. Point OpenClaw at the bridge script

On the **host that runs `openclaw gateway`**, set:

```bash
# Absolute path to guardmesh-bridge.mjs in *this* repo clone
export GUARDMESH_BRIDGE_SCRIPT="/path/to/open/integrations/openclaw/guardmesh-bridge.mjs"

# Optional — if Next listens elsewhere
# export GUARDMESH_BRIDGE_URL="http://127.0.0.1:3000/api/guardmesh/intent"
```

Windows (persistent user env): System Properties → Environment Variables, or set in the shell profile you use to launch OpenClaw.

### One-shot Windows setup (this repo)

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File integrations/openclaw/apply-openclaw-config.ps1
```

That creates/updates `%USERPROFILE%\.openclaw\openclaw.json` with `skills.load.extraDirs` pointing at this clone’s `integrations/openclaw/skills`, and runs `setx GUARDMESH_BRIDGE_SCRIPT` to this clone’s `guardmesh-bridge.mjs`. **Open a new terminal** (or restart the Gateway) after `setx` so the variable is visible.

## 4. Load the GuardMesh skill into OpenClaw

OpenClaw scans skill dirs; `apply-openclaw-config.ps1` (or manual edit) adds this repo’s `skills` path to `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    load: {
      extraDirs: ["/absolute/path/to/open/integrations/openclaw/skills"]
    }
  }
}
```

Restart the Gateway (`openclaw gateway restart` or your daemon flow). The **`guardmesh`** skill should appear; it teaches the model to call `node $GUARDMESH_BRIDGE_SCRIPT intent.json` via **`exec`** before dangerous work. Prefer **`--strict-consensus`** so the process exits non-zero unless **`consensus.execute`** is true (see `guardmesh-bridge.mjs`).

### Mesh consensus → OpenClaw `POST /tools/invoke`

For automation **outside** the model (CI, a wrapper daemon), you can run mesh first then call the Gateway’s documented HTTP tool endpoint:

```bash
export OPENCLAW_GATEWAY_TOKEN="…"   # same as gateway.auth.token / OPENCLAW_GATEWAY_TOKEN in OpenClaw docs
# optional: export OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
node integrations/openclaw/mesh-then-openclaw-invoke.mjs integrations/openclaw/examples/mesh-then-invoke.example.json
```

Add **`--require-uncontested`** to skip the invoke step when **`consensus.contested`** is true (2 approve / 1 block case still returns `execute: true`).

Omit the **`"invoke"`** block from the JSON to only print the intent API response (same as the bridge).

## 5. Code analysis from OpenClaw (same JSON as the dashboard)

With `Web` dev server up and **`OPENAI_API_KEY`** in `Web/.env` or `Web/.env.local` (see `Web/.env.example`):

1. On **Agent analysis** (`/home/analyze`), copy the **body.json** block (includes `persistForDashboard: true`).
2. From the **repo root**:

```bash
node integrations/openclaw/run-code-analysis.mjs body.json
```

Optional second argument: base URL (default `http://127.0.0.1:3000`). If **`GUARDMESH_TOOL_SECRET`** is set in `Web/.env` / `Web/.env.local`, the script sends **`Authorization: Bearer …`** automatically — same wiring as adding the header manually to `exec` / `curl`.

In OpenClaw **exec**, run the same command (absolute path to this repo’s `run-code-analysis.mjs` and `body.json`).

## 6. Quick test (no OpenClaw)

With `Web` dev server up:

```bash
cd integrations/openclaw
node guardmesh-bridge.mjs examples/intent.example.json
```

With mesh + guardians running you should see `sendResults`, `verdicts`, **`consensus`**, and **`consensus_threshold`** in the JSON. **`consensus.finalDecision`** is the line your agent should follow; the bridge also prints it to **stderr**.

Optional **`consensus_threshold`** in the same JSON as **`intent`** (or **`GUARDMESH_CONSENSUS_THRESHOLD`** on the `Web` server): `phase5` \| `unanimous` \| `majority` \| `any`. See `Web/lib/guardmesh-consensus.ts`.

## Files

| File | Role |
|------|------|
| `guardmesh-bridge.mjs` | CLI: POST `{ intent, consensus_threshold? }` to `GUARDMESH_BRIDGE_URL`; **`--strict`**, **`--strict-consensus`**, **`--strict-final`** |
| `mesh-then-openclaw-invoke.mjs` | After mesh **`consensus.execute`**, optional **`POST /tools/invoke`** on the OpenClaw Gateway ([docs](https://docs.openclaw.ai/gateway/tools-invoke-http-api.md)) |
| `run-code-analysis.mjs` | POST `body.json` to `/api/guardmesh/run/code-analysis`; reads `GUARDMESH_TOOL_SECRET` from `Web/.env` or `Web/.env.local` when present |
| `openclaw.recommended-tools-fragment.json` | Optional **`tools.loopDetection`** snippet to merge into `openclaw.json` |
| `skills/guardmesh/SKILL.md` | OpenClaw skill instructions |
| `examples/intent.example.json` | Sample intent payload |
| `examples/intent-with-threshold.example.json` | Wrapped intent + **`consensus_threshold`** |
| `examples/mesh-then-invoke.example.json` | Intent + **`invoke`** for `mesh-then-openclaw-invoke.mjs` |
| `openclaw.channels.enterprise-guardmesh-fragment.json` | Multi-channel baseline for Teams/Slack/Mattermost/Matrix/Feishu with pairing + allowlist + mention gate defaults |

## Enterprise channel guard (Meta-incident controls)

`Web/app/api/guardmesh/run/openclaw-agent` now supports optional per-message `channelContext`:

```json
{
  "channelContext": {
    "channel": "msteams",
    "userId": "aad-user-id",
    "groupId": "team-or-channel-id",
    "mentioned": true
  }
}
```

When `OPENCLAW_ENTERPRISE_CHANNEL_POLICY_JSON` is configured, the route enforces:

- channel enabled/disabled
- DM policy (`pairing` / `allowlist` / `open` / `disabled`)
- group policy (`allowlist` / `open` / `disabled`)
- mention requirement in groups
- explicit user/group allowlists

Denied messages return HTTP `403` before any OpenClaw model execution.

### Files added/updated

- New guard logic: `Web/lib/openclaw-channel-guard.ts`
- OpenClaw agent route integrated with channel guard: `Web/app/api/guardmesh/run/openclaw-agent/route.ts`
- Enterprise channel config fragment for OpenClaw: `integrations/openclaw/openclaw.channels.enterprise-guardmesh-fragment.json`
- Env example updated: `integrations/openclaw/.env.example`
- README updated with usage: `integrations/openclaw/README.md`

### Supported enterprise channels

- `msteams`
- `slack`
- `mattermost`
- `matrix`
- `feishu`

### How to use

1. Set `OPENCLAW_ENTERPRISE_CHANNEL_POLICY_JSON` on the Web server.
2. Call `/api/guardmesh/run/openclaw-agent` with:

```json
{
  "action": "code_analysis",
  "userMessage": "analyze and summarize",
  "toolResult": {},
  "channelContext": {
    "channel": "msteams",
    "userId": "aad-user-id",
    "groupId": "team-or-channel-id",
    "mentioned": true
  }
}
```

## Exec approvals

If OpenClaw blocks `node` until approved, add an **exec allowlist** entry for `guardmesh-bridge.mjs` (see OpenClaw docs: [**Exec**](https://docs.openclaw.ai/tools/exec.md), [**Exec approvals**](https://docs.openclaw.ai/tools/exec-approvals.md))). Use **`--strict-consensus`** for **`consensus.execute`**, or **`--strict-final`** so the process exits non-zero unless **`finalDecision.action`** is **`execute`** or **`execute_contested`**. **`--strict`** only checks that some row in **`verdicts`** is APPROVE.
