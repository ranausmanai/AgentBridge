# AgentBridge Ops Memory

Last updated: 2026-02-27

## 1) Spotify/Groq tool-call failures (quality + token size)

### Symptoms
- Groq returned `400 Failed to call a function` on some prompts.
- Groq returned `413 Request too large` when many tools were sent.

### Root cause
- Too many tool definitions were sent per turn (Spotify has 25 actions).
- Verbose JSON schema descriptions/defaults increased payload size.
- Free/on-demand Groq tiers have tight limits.

### Fixes implemented
- Added schema compaction before sending tools:
  - `/Users/usman/Documents/Vibed/clitest/packages/core/src/plugin-registry.ts`
  - Removes non-essential fields (`description`, `default`, etc.) from tool parameter schemas.
- Added relevance-based tool selection per turn:
  - `selectLLMTools(userInput, maxTools)` in same file.
  - Engine now sends only top-N likely tools for current user message.
- Added max tools config in engine:
  - `/Users/usman/Documents/Vibed/clitest/packages/core/src/engine.ts`
  - `/Users/usman/Documents/Vibed/clitest/packages/core/src/types.ts`
- Wired budgets:
  - Web: `/Users/usman/Documents/Vibed/clitest/apps/web/src/lib/bridge.ts`
    - Groq: 6, others: 12
  - CLI: `/Users/usman/Documents/Vibed/clitest/packages/cli/src/index.ts`
    - `AGENTBRIDGE_MAX_TOOLS` (default 8)
- Added provider fallback in OpenAI-compatible provider:
  - `/Users/usman/Documents/Vibed/clitest/packages/llm/src/openai.ts`
  - Retry without tools on certain 400 errors.
  - Retry with reduced tools on 413.

### Validation done
- Build passed for core/llm/openapi/cli/web.
- Local measurement showed tool payload reduction with Spotify prompt:
  - full set vs selected subset reduced estimated tokens significantly.

### Important tradeoff
- Lower tool budget can reduce quality for edge prompts.
- If results degrade, raise budget (`AGENTBRIDGE_MAX_TOOLS`) or implement adaptive retry (small budget first, auto-expand on low-confidence/no-tool-call).


## 2) Built-in Spotify API + OAuth flow

### Added
- Built-in Spotify manifest and defaults:
  - `/Users/usman/Documents/Vibed/clitest/packages/openapi/src/builtins/spotify.ts`
  - `/Users/usman/Documents/Vibed/clitest/packages/openapi/src/builtins/index.ts`
- Built-ins exported and auto-resolved:
  - `/Users/usman/Documents/Vibed/clitest/packages/openapi/src/index.ts`
  - `/Users/usman/Documents/Vibed/clitest/packages/openapi/src/registry.ts`

### CLI OAuth improvements
- Uses built-in client ID defaults when available.
- Uses fixed callback port for Spotify (`8574`) to match registered redirect URI.
- Better handling for `EADDRINUSE`.

### Web improvements
- Built-ins seeded into DB (`owner_id='__builtin__'`, public).
- OAuth start/callback routes can use built-in client config fallback.
- Chat UI shows one-click connect for built-in OAuth APIs.
- Gemini provider added for web and CLI.


## 3) VPS deployment pitfalls and fixes

Target VPS: `root@187.77.31.25`

### What broke
- Synced local `docker-compose.yml` had `3000:3000`.
- VPS already had another service on port 3000.
- Container failed with: `Bind for 0.0.0.0:3000 failed: port is already allocated`.

### Working config on VPS
- `/root/agentbridge/docker-compose.yml` must map:
  - `3001:3000`
- Keep `env_file: .env.local` so existing hosted env vars remain in use.

### Verified after fix
- Container up with `0.0.0.0:3001->3000/tcp`.
- `http://localhost:3001/api/apis` returns JSON.
- `https://agentbridge.cc/api/apis` returns Spotify with:
  - `is_builtin: true`
  - `action_count: 25`


## 4) npm and git release state from this cycle

### Git
- Pushed commit: `7d051d7` to `main` (`origin`).

### Published packages
- `@agentbridgeai/core@0.1.1`
- `@agentbridgeai/llm@0.1.1`
- `@agentbridgeai/openapi@0.1.2`
- `@agentbridgeai/cli@0.1.5`

### Publish order used
1. core
2. llm
3. openapi
4. cli


## 5) Useful commands (known good)

### Local build sanity
```bash
pnpm --filter @agentbridgeai/core build
pnpm --filter @agentbridgeai/llm build
pnpm --filter @agentbridgeai/openapi build
pnpm --filter @agentbridgeai/cli build
pnpm --filter web build
```

### CLI update for users
```bash
npm i -g @agentbridgeai/cli@0.1.5
hash -r
agentbridge --version
```

### VPS deploy (docker)
```bash
ssh root@187.77.31.25
cd /root/agentbridge
docker compose build --no-cache
docker compose up -d
```

### VPS health checks
```bash
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
curl -i http://localhost:3001/api/apis
curl -s https://agentbridge.cc/api/apis
```


## 6) Security notes

- Do not store raw API keys/tokens/passwords in repo files.
- If credentials are pasted in chat/terminal, rotate them immediately.
- Keep OAuth client secret server-side only (never in client bundle).
