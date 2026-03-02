# AgentBridge — Public Launch Release Notes

**Version: 0.1.0 — Initial Public Release**
**Date: 2026-03-03**

---

## What is AgentBridge?

AgentBridge is an open-source framework that makes any REST API accessible to AI agents in under 30 seconds. It provides:

1. An **open manifest standard** (`.agentbridge.json`) that encodes everything an agent needs to discover and call an API
2. An **OpenAPI → manifest converter** that works with any existing OpenAPI 3.x or Swagger 2.0 spec
3. An **agentic runtime engine** that handles LLM tool-calling, authentication, retries, and session management
4. A **multi-LLM provider layer** supporting Claude, GPT, Groq, Gemini, and Ollama
5. A **CLI**, **TypeScript SDK**, **MCP server**, and **web dashboard** — all composable independently

---

## Core Features

### 1. Manifest Standard

The `.agentbridge.json` format is the foundational primitive. It encodes:

- API name, description, version, base URL
- Authentication configuration (bearer, API key, OAuth2 with full token URLs and scopes)
- A flat list of `actions` — each with an ID, description, HTTP method, path, and typed parameters

Any agent runtime that understands this format can call your API. Host it at `/.well-known/agentbridge.json` for automatic discovery.

### 2. OpenAPI Converter

```bash
npx agentbridge init
```

Accepts OpenAPI 3.x JSON/YAML or Swagger 2.0 specs via stdin or file. Outputs a validated `.agentbridge.json`. Supports:

- Path and query parameter extraction
- Request body schema flattening
- Auth scheme detection
- Tag-based filtering to limit exported actions
- Configurable `maxActions` to control manifest size

### 3. AgentBridge Engine

The core runtime (`@agentbridgeai/core`). Key behaviors:

- **Agentic loop**: runs up to 10 iterations of `LLM → tool selection → tool execution → result injection → LLM`
- **Auth error handling**: detects 401/403 responses and surfaces them with guidance
- **Tool call failure recovery**: on failure, reduces tool count and retries; falls back to no-tools mode if needed
- **Session management**: each `sessionId` maintains independent conversation history
- **Callbacks**: `onToolCall` and `onToolResult` for observability hooks

### 4. Smart Tool Selection

When multiple plugins are loaded, the combined tool count can exceed LLM context budgets. The `PluginRegistry` solves this with a relevance scoring algorithm:

1. Tokenize user input (split, lowercase, deduplicate stopwords)
2. For each action: score based on name token overlap + description token overlap + keyword matches
3. Boost score if the user explicitly names the plugin
4. Enforce companion tools (some actions require prerequisites to succeed)
5. Return the top N tools within the configured `maxToolsPerTurn` budget

Default budgets: Groq = 6 tools/turn, all others = 12 tools/turn.

### 5. Authentication

Runtime supports three auth modes, configured in the manifest:

| Type | Behavior |
|------|----------|
| `bearer` | Injects `Authorization: Bearer <token>` on every request |
| `api_key` | Injects key in header or query param per manifest config |
| `oauth2` | Full authorization code flow with token refresh |

Built-in OAuth flows for **Spotify**, **Gmail**, and **Google Calendar** — users need no client ID setup.

### 6. LLM Providers

| Provider | Package Config |
|----------|---------------|
| Anthropic Claude | `ClaudeProvider({ apiKey })` |
| OpenAI GPT | `OpenAIProvider({ apiKey })` |
| Groq | `OpenAIProvider({ apiKey, baseURL: "https://api.groq.com/openai/v1" })` |
| Gemini 2.0 Flash | OpenAI-compatible |
| Ollama | `OpenAIProvider({ baseURL: "http://localhost:11434/v1" })` |

Provider switching requires no engine code changes.

### 7. MCP Server

```bash
agentbridge mcp setup spotify
agentbridge mcp setup gmail
```

Generates MCP server configuration that exposes AgentBridge plugins as tools to:
- Claude Desktop
- Cursor
- Windsurf

### 8. Plugin SDK

Define a custom plugin in ~20 lines:

```typescript
import { definePlugin } from "@agentbridgeai/sdk"
import { z } from "zod"

export const myPlugin = definePlugin({
  name: "my-api",
  description: "What my API does",
  actions: [{
    name: "do_thing",
    description: "Does the thing",
    parameters: z.object({
      input: z.string().describe("The input value")
    }),
    execute: async ({ input }, ctx) => {
      const res = await fetch(`https://api.example.com/thing?q=${input}`, {
        headers: { Authorization: `Bearer ${ctx.auth?.token}` }
      })
      return res.json()
    }
  }]
})
```

### 9. CLI

```
agentbridge chat [api]        Chat with one or more APIs by name
agentbridge init              Convert OpenAPI spec to .agentbridge.json
agentbridge publish           Register your API on agentbridge.cc
agentbridge search <keyword>  Search the API directory
agentbridge discover <domain> Find manifest at a domain
agentbridge mcp setup <api>   Configure MCP integration
```

### 10. Web Dashboard (agentbridge.cc)

- Searchable directory of registered agent-ready APIs
- In-browser chat with any API (no install required)
- Credential management with encryption at rest
- API registration and manifest publishing
- One-click Vercel deploy for self-hosting

---

## Package Architecture

This is a pnpm monorepo. Packages are independently installable:

| Package | npm | Purpose |
|---------|-----|---------|
| `@agentbridgeai/core` | ✓ | Engine, plugin registry, conversation manager |
| `@agentbridgeai/openapi` | ✓ | OpenAPI converter, manifest-to-plugin runtime |
| `@agentbridgeai/llm` | ✓ | Claude + OpenAI-compatible providers |
| `@agentbridgeai/cli` | ✓ | Command-line interface |
| `@agentbridgeai/sdk` | ✓ | Embed in your application |
| `@agentbridgeai/mcp` | ✓ | MCP server |
| `@agentbridgeai/web` | — | Next.js dashboard (self-host or use agentbridge.cc) |

---

## Built-in APIs

The following APIs are pre-configured with manifests and OAuth:

### Spotify
- 25+ actions: search tracks/albums/artists, control playback, manage playlists, get recommendations
- Built-in OAuth2 with public client ID (PKCE)
- Automatic user ID resolution for actions that require it

### Gmail
- Compose, send, read, search emails
- Google OAuth2

### Google Calendar
- List, create, update calendar events
- Google OAuth2

---

## Known Limitations in 0.1.0

- Manifest spec does not yet support streaming responses
- Pagination is not automatically handled (agents must request next pages)
- No built-in rate limiting / backoff in the manifest runtime
- OAuth token refresh is implemented for Spotify; Gmail/Calendar refresh pending
- Web dashboard requires Supabase for credential storage (optional for local dev)

---

## What's Next

- Manifest v1.1 spec: streaming support, pagination hints, rate limit metadata
- Auto-pagination mode in the engine
- Official manifest registry API with SDKs for Python, Go, Rust
- Agent-to-agent discovery protocol
- More built-in APIs

---

## Contributing

Issues, PRs, and feature requests welcome. See `CONTRIBUTING.md`.

The manifest spec itself is open — if you're building a runtime, agent framework, or tool that can consume `.agentbridge.json`, open an issue and we'll link to it.

---

## License

MIT. No restrictions. Build on it.
