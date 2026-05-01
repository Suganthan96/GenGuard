# OpenClaw Channel Integration Checklist (GuardMesh)

This project enforces channel policy in:

- `Web/lib/openclaw-channel-guard.ts`
- `Web/app/api/guardmesh/run/openclaw-agent/route.ts`
- `Web/app/home/analyze/page.tsx` (channel + user/group/mention inputs)

## 1) What is already integrated in this repo

- Channel selector: `msteams`, `slack`, `mattermost`, `matrix`, `feishu`
- Runtime channel guard checks before OpenClaw reply:
  - `enabled`
  - `dmEnabled`
  - `dmPolicy`
  - `groupPolicy`
  - `requireMention`
  - `allowFrom`, `groupAllowFrom`
  - `allowedUsers`, `allowedGroups`
- Agent page passes `channelContext`:
  - `channel`
  - `userId`
  - `groupId`
  - `mentioned`

## 2) What you still must configure on OpenClaw Gateway

These are external runtime requirements (not done by this repo automatically):

- **Microsoft Teams**: `appId`, `appPassword`, `tenantId`, webhook/tunnel setup.
- **Slack**: `botToken`, `appToken` (Socket Mode) or signing secret (HTTP mode).
- **Mattermost**: `botToken`, `baseUrl`.
- **Matrix**: `homeserver` + token/password.
- **Feishu**: account app ID + app secret; websocket/webhook mode.

## 3) Required policy env on Web server

Set on the Web server (`Web/.env.local` in local dev):

- `OPENCLAW_ENTERPRISE_CHANNEL_POLICY_JSON=<json>`

Use stable platform IDs in allowlists:

- Teams: AAD object IDs and Teams conversation IDs.
- Slack: `U...` user IDs and `C.../G...` channel IDs.
- Mattermost: user IDs and channel IDs.
- Matrix: `@user:server` and `!room:server`.
- Feishu: `ou_xxx` user open_id and `oc_xxx` chat_id.

## 4) Teams gotcha

Invite links are **not** the conversation ID used for routing policy.  
For Teams allowlists, use real IDs from Graph/event payloads.

