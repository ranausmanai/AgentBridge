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


## 7) 400/429 "status code (no body)" in web chat

### Symptoms
- UI chat sometimes returned opaque errors like:
  - `400 status code (no body)`
  - `429 status code (no body)`

### Root causes found
- Provider responses from OpenAI-compatible SDK can surface with minimal body.
- Web API route (`/api/chat`) was always returning HTTP 500, hiding true upstream status.
- During no-tool fallback, models could still phrase responses as if data had been fetched.

### Fixes implemented
- `/Users/usman/Documents/Vibed/clitest/packages/llm/src/openai.ts`
  - Added resilient retry path for tool-mode failures:
    - retry with fewer tools on 400/413
    - then retry without tools when needed
  - Added provider-aware error normalization:
    - clearer messages for 401/429 and generic 400-no-body cases
    - preserves `err.status` for caller
- `/Users/usman/Documents/Vibed/clitest/apps/web/src/app/api/chat/route.ts`
  - Now returns the actual provider status code when available (not always 500).
- `/Users/usman/Documents/Vibed/clitest/packages/core/src/engine.ts`
  - System prompt now explicitly forbids claiming actions/data fetches unless tools actually ran successfully.

### Validation done
- Web `/api/chat` with Groq key + Spotify:
  - returns 200 and tool-call failure message when Spotify token missing (expected).
- Web `/api/chat` with Gemini key:
  - returns HTTP 429 with clear quota message (instead of opaque 500/no-body).
- CLI interactive chat with Spotify:
  - tool call executes and reports 401 token-missing clearly.


## 8) Spotify playlist creation loops / slow replies

### Symptoms
- After OAuth, `search` worked but `create_playlist` could loop/fail with guessed `user_id` values like:
  - `user_id`
  - `current_user`
  - `<spotify__get_current_user>`
- Chat felt slow due repeated LLM/tool iterations.

### Root cause
- Spotify playlist create endpoint needs path param `{user_id}`.
- Model sometimes guessed placeholders instead of reliably extracting id from `get_current_user`.

### Fixes implemented
- Companion tool enforcement in tool selection:
  - `/Users/usman/Documents/Vibed/clitest/packages/core/src/plugin-registry.ts`
  - If `spotify.create_playlist` is selected, force include `spotify.get_current_user`.
- Execution-layer auto-resolution for Spotify `user_id`:
  - `/Users/usman/Documents/Vibed/clitest/packages/openapi/src/manifest-to-plugin.ts`
  - For `spotify.create_playlist`, if `user_id` is missing/placeholder, call `GET /me` and inject real id before calling playlist create endpoint.

### Expected impact
- Fewer repeated tool attempts.
- Faster response in playlist creation flow.
- Better reliability after OAuth without asking user for `user_id`.


## 9) OpenAI schema error: array missing `items`

### Symptom
- Web chat failed with:
  - `400 Invalid schema for function 'spotify__add_tracks_to_playlist': ... array schema missing items`

### Root cause
- Generated tool JSON schema had:
  - `"uris": { "type": "array" }`
  - without an `items` field.
- OpenAI function schema validator rejects arrays missing `items`.

### Fix
- `/Users/usman/Documents/Vibed/clitest/packages/core/src/plugin-registry.ts`
  - Added `ensureValidToolSchema(...)` normalization.
  - If schema type is `array` and `items` is missing, inject `items: {}`.

### Verification
- Local generated schema now shows:
  - `"uris": { "type": "array", "items": {} }`
