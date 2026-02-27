<p align="center">
  <img src=".github/logo.svg" width="120" height="120" alt="AgentBridge Logo" />
</p>

<h1 align="center">AgentBridge</h1>

<p align="center">
  <strong>Make any API agent-ready in 30 seconds.</strong><br/>
  The open-source bridge between APIs and AI agents.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-22d3ee.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/@agentbridgeai/cli"><img src="https://img.shields.io/npm/v/@agentbridgeai/cli?style=flat-square&color=22d3ee&label=npm" alt="npm" /></a>
  <a href="https://agentbridge.cc"><img src="https://img.shields.io/badge/Directory-agentbridge.cc-22d3ee?style=flat-square" alt="Directory" /></a>
  <a href="https://github.com/ranausmanai/AgentBridge/stargazers"><img src="https://img.shields.io/github/stars/ranausmanai/AgentBridge?style=flat-square&color=22d3ee" alt="Stars" /></a>
  <a href="#packages"><img src="https://img.shields.io/badge/Packages-7-22d3ee?style=flat-square" alt="Packages" /></a>
</p>

<p align="center">
  <a href="https://agentbridge.cc">Website</a> ·
  <a href="https://discord.gg/UW67PSwF">Discord</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-for-api-owners">API Owners</a> ·
  <a href="#-for-agent-builders">Agent Builders</a> ·
  <a href="#-packages">Packages</a> ·
  <a href="#-self-hosting">Self-Hosting</a>
</p>

---

> *"If you have any kind of product or service, think: can agents access and use them?"* — Andrej Karpathy

Most APIs are built for humans writing code. But AI agents need to **discover, understand, and call APIs autonomously**. AgentBridge makes any API agent-ready — paste your OpenAPI spec, get an instant bridge to every AI agent in the world.

```
  Your API          AgentBridge           AI Agents
 ┌─────────┐      ┌─────────────┐      ┌──────────┐
 │ OpenAPI  │ ───▶ │  .agentbridge│ ───▶ │ Claude   │
 │  Spec    │      │    .json     │      │ GPT      │
 │          │      │              │      │ Groq     │
 │ REST API │ ◀─── │  Auto-call   │ ◀─── │ Ollama   │
 └─────────┘      └─────────────┘      └──────────┘
```

## ✨ Quick Start

### One command to chat with any API

```bash
npx agentbridge chat spotify
# → Searches the directory, installs, starts chatting
# → "play some jazz music"
```

### One command to make your API agent-ready

```bash
npx agentbridge init
# → Paste your OpenAPI spec
# → Get .agentbridge.json manifest
# → Any AI agent can now use your API
```

## 🔌 For API Owners

Make your API discoverable and usable by every AI agent in the world.

#### Step 1: Generate your manifest

```bash
npx agentbridge init
# Paste your OpenAPI spec (JSON or YAML)
# → Generates .agentbridge.json
```

#### Step 2: Publish to the directory

```bash
npx agentbridge publish
# → Registers on agentbridge.cc
# → Instantly available to all agents
```

Or register via the web at [agentbridge.cc/register](https://agentbridge.cc/register).

#### Step 3: Auto-discovery (optional)

Host your manifest at a well-known URL — like `robots.txt` for agents:

```
https://yourapi.com/.well-known/agentbridge.json
```

Any agent can now auto-discover your API:

```bash
agentbridge discover yourapi.com
# → Found: your-api (15 actions)
```

## 🤖 For Agent Builders

Use any agent-ready API in seconds. Bring your own LLM key.

### CLI — Talk to any API

```bash
# One command does it all: search → install → chat
npx agentbridge chat pet-store
> find me available pets
# → Found 3 available pets: Buddy (dog), Whiskers (cat)...

# Or search the directory first
agentbridge search weather
# → weather-api (12 actions) — Real-time weather data
# → Install: agentbridge chat weather-api
```

### MCP — Claude Desktop, Cursor, Windsurf

Recommended onboarding (installs API, handles auth, configures clients, health-checks MCP):

```bash
# Works for OAuth + token APIs
agentbridge mcp setup spotify
agentbridge mcp setup gmail
agentbridge mcp setup extractly-api
```

Direct MCP server usage:

```bash
npx @agentbridgeai/mcp --openapi ./openapi.json
```

Add to Claude Desktop (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["@agentbridgeai/mcp", "--openapi", "./openapi.json"]
    }
  }
}
```

### SDK — Embed in your app

```typescript
import { AgentBridgeEngine } from '@agentbridgeai/core';
import { OpenAIProvider } from '@agentbridgeai/llm';
import { convertOpenAPIToManifest, manifestToPlugin } from '@agentbridgeai/openapi';

// Any OpenAPI spec → agent-ready plugin
const manifest = convertOpenAPIToManifest(openApiSpec);
const plugin = manifestToPlugin(manifest);

// Create engine with any LLM
const engine = new AgentBridgeEngine({
  llmProvider: new OpenAIProvider({ apiKey: 'sk-...' }),
  plugins: [plugin],
});

// Chat naturally
const session = engine.createSession();
const response = await engine.chat(session, 'find available pets');
console.log(response.message);
```

### Web — Chat in the browser

Visit [agentbridge.cc/chat](https://agentbridge.cc/chat), pick your APIs, enter your LLM key, and start chatting. No installation needed.

## 📦 Packages

| Package | Description | |
|---|---|---|
| [`@agentbridgeai/core`](packages/core) | Engine, plugin registry, conversation manager | [![npm](https://img.shields.io/npm/v/@agentbridgeai/core?style=flat-square&color=22d3ee&label=)](https://www.npmjs.com/package/@agentbridgeai/core) |
| [`@agentbridgeai/llm`](packages/llm) | LLM providers — Claude, GPT, Groq, Ollama, any OpenAI-compatible | [![npm](https://img.shields.io/npm/v/@agentbridgeai/llm?style=flat-square&color=22d3ee&label=)](https://www.npmjs.com/package/@agentbridgeai/llm) |
| [`@agentbridgeai/openapi`](packages/openapi) | OpenAPI spec → agent-ready manifest converter | [![npm](https://img.shields.io/npm/v/@agentbridgeai/openapi?style=flat-square&color=22d3ee&label=)](https://www.npmjs.com/package/@agentbridgeai/openapi) |
| [`@agentbridgeai/mcp`](packages/mcp) | MCP server — expose APIs to Claude, Cursor, Windsurf | [![npm](https://img.shields.io/npm/v/@agentbridgeai/mcp?style=flat-square&color=22d3ee&label=)](https://www.npmjs.com/package/@agentbridgeai/mcp) |
| [`@agentbridgeai/sdk`](packages/sdk) | SDK for building custom agent plugins | [![npm](https://img.shields.io/npm/v/@agentbridgeai/sdk?style=flat-square&color=22d3ee&label=)](https://www.npmjs.com/package/@agentbridgeai/sdk) |
| [`@agentbridgeai/cli`](packages/cli) | CLI — chat with APIs from your terminal | [![npm](https://img.shields.io/npm/v/@agentbridgeai/cli?style=flat-square&color=22d3ee&label=)](https://www.npmjs.com/package/@agentbridgeai/cli) |
| [`@agentbridgeai/web`](apps/web) | Web dashboard — browse, register, chat | [agentbridge.cc](https://agentbridge.cc) |

## 📋 The Manifest Format

The `.agentbridge.json` manifest is the open standard at the heart of AgentBridge. It describes your API in a way any agent can understand:

```json
{
  "schema_version": "1.0",
  "name": "pet-store",
  "description": "A pet store API",
  "version": "1.0.0",
  "base_url": "https://petstore.example.com/api",
  "auth": { "type": "bearer" },
  "actions": [
    {
      "id": "findPetsByStatus",
      "description": "Find pets by their availability status",
      "method": "GET",
      "path": "/pet/findByStatus",
      "parameters": [
        {
          "name": "status",
          "description": "Pet status to filter by",
          "in": "query",
          "required": true,
          "type": "string",
          "enum": ["available", "pending", "sold"]
        }
      ]
    }
  ]
}
```

## 🌐 The Ecosystem

```
 ┌──────────────────────────────────────────────────────────┐
 │                      API Owners                          │
 │            Spotify · Stripe · Your Startup               │
 │                                                          │
 │  1. npx agentbridge init                                 │
 │  2. npx agentbridge publish                              │
 │  3. (optional) Host .well-known/agentbridge.json         │
 └──────────────────────┬───────────────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │    AgentBridge     │
              │     Directory      │
              │  agentbridge.cc    │
              │                    │
              │  Indexes APIs      │
              │  Open standard     │
              │  No vendor lock-in │
              └─────────┬──────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
       CLI           MCP Server     SDK / Web
   npx agentbridge   Claude Desktop  Your app
      chat           Cursor / VS     agents
                     Code / Windsurf
```

## 🔍 Discovery API

Agents can programmatically discover APIs:

```bash
# Search by keyword
curl https://agentbridge.cc/api/discover?q=music

# Get a manifest directly
curl https://agentbridge.cc/api/pet-store/manifest

# Submit your API
curl -X POST https://agentbridge.cc/api/submit \
  -d '{"url": "https://yourapi.com/.well-known/agentbridge.json"}'
```

## 🏠 Self-Hosting

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_PATH` | No | Path to SQLite database file. Defaults to `./agentbridge.db` |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL. Omit to disable auth entirely |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anon key. Required if `SUPABASE_URL` is set |
| `PORT` | No | Server port. Defaults to `3000` |
| `NODE_ENV` | No | Set to `production` for optimized builds |

> **Auth is optional.** If Supabase env vars are not set, the app runs without login — all features (browse, register, chat, dashboard) work for everyone. Set Supabase vars to enable user accounts, API ownership, and per-user dashboards.

Copy `.env.example` to `apps/web/.env.local` to get started.

### Docker

```bash
docker compose up -d
# → Dashboard at http://localhost:3000
```

To enable auth, uncomment the Supabase lines in `docker-compose.yml`.

### Docker (manual)

```bash
docker build -t agentbridge .
docker run -p 3000:3000 -v agentbridge-data:/app/apps/web/data agentbridge

# With auth:
docker run -p 3000:3000 \
  -v agentbridge-data:/app/apps/web/data \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  agentbridge
```

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ranausmanai/AgentBridge&root-directory=apps/web)

## 🛠️ Building from Source

```bash
git clone https://github.com/ranausmanai/AgentBridge.git
cd AgentBridge
pnpm install
pnpm build
```

### Development

```bash
# Run the web dashboard
cd apps/web && pnpm dev

# Run the CLI in dev mode
cd packages/cli && pnpm dev
```

## 💡 Philosophy

- **Open standard** — `.agentbridge.json` is the spec. No vendor lock-in. Ever.
- **Decentralized** — API owners host their own manifests. We index, not host.
- **Open source** — MIT licensed. Fork it, self-host it, make it yours.
- **BYOK** — Bring your own LLM key. We never touch your credentials.
- **Agent-first** — Built for the agentic era.

## 🤝 Contributing

We welcome contributions! Whether it's fixing bugs, adding LLM providers, improving docs, or building new integrations.

```bash
git clone https://github.com/ranausmanai/AgentBridge.git
cd AgentBridge
pnpm install
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT — do whatever you want with it.

---

<p align="center">
  <strong>Build for agents.</strong><br/>
  <a href="https://agentbridge.cc">agentbridge.cc</a>
</p>
