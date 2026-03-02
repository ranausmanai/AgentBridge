# AgentBridge Launch Thread
### Platform: X (Twitter)
### Goal: Factual features → 10k GitHub stars

---

## Thread

---

**[1/18]**

AI agents can't use most APIs.

Not because the APIs are bad — but because they were built for humans writing code, not agents making autonomous decisions.

We built AgentBridge to fix that. Open source. MIT. Ships today.

github.com/ranausmanai/AgentBridge

---

**[2/18]**

The problem in one line:

An agent knows *what* it wants to do. It doesn't know *how* to call your API, *which* endpoint to hit, or *how* to authenticate.

AgentBridge closes that gap with a single standard: `.agentbridge.json`

---

**[3/18]**

If you have an OpenAPI spec, you're already 30 seconds away from being agent-ready.

```bash
npx agentbridge init
# Paste your OpenAPI spec → get .agentbridge.json instantly
```

That manifest file is everything an AI agent needs to discover, understand, and call your API — autonomously.

---

**[4/18]**

What's in the manifest?

```json
{
  "schema_version": "1.0",
  "name": "your-api",
  "base_url": "https://api.yourdomain.com",
  "auth": { "type": "bearer" },
  "actions": [
    {
      "id": "get_user",
      "description": "Fetch a user by ID",
      "method": "GET",
      "path": "/users/{id}",
      "parameters": [...]
    }
  ]
}
```

Host it at `/.well-known/agentbridge.json` → any agent on earth can find and use your API automatically.

---

**[5/18]**

For agent builders: one command to chat with any API.

```bash
npx agentbridge chat spotify
> play some jazz music
> create a playlist called "deep work" with 20 tracks
> what's currently playing?
```

No SDK setup. No reading docs. No writing request builders. Just talk to the API.

---

**[6/18]**

It's not just a CLI wrapper.

Under the hood, the engine runs a full agentic loop:

User message → LLM → Tool selection → API call → Results → LLM → Response

Max 10 iterations. Handles retries. Catches auth errors. Returns gracefully.

All configurable.

---

**[7/18]**

The hardest problem in multi-API agents: too many tools blows up your context window.

We built a **Smart Tool Selection algorithm** that solves this:

1. Tokenize the user's message
2. Score every available action by name overlap, description match, keyword match
3. Pick the top N tools that fit the provider's budget
4. Enforce companion tools (if you're creating a playlist, you need `get_current_user`)

No more 413 errors. No more hallucinated tool calls.

---

**[8/18]**

Every major LLM provider. One engine.

```typescript
// Claude
new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY })

// OpenAI / GPT
new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY })

// Groq (LLaMA 3.3-70b)
new OpenAIProvider({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })

// Ollama (local, free)
new OpenAIProvider({ baseURL: "http://localhost:11434/v1" })
```

Switch providers without changing your agent code.

---

**[9/18]**

Auth is the other hard problem. We handle all of it.

- **Bearer tokens**: injected automatically per request
- **API keys**: header or query param, your config
- **OAuth2**: full flow — authorization, token exchange, refresh

Built-in OAuth for Spotify, Gmail, and Google Calendar. No client ID hunting required.

---

**[10/18]**

MCP (Model Context Protocol) is first-class.

```bash
agentbridge mcp setup spotify
agentbridge mcp setup gmail
```

Your APIs instantly become tools in Claude Desktop, Cursor, and Windsurf. One command. No config files to edit manually.

---

**[11/18]**

For teams embedding this in products — there's a full TypeScript SDK.

```typescript
const engine = new AgentBridgeEngine({
  llmProvider: new ClaudeProvider({ apiKey }),
  plugins: [spotifyPlugin, calendarPlugin],
  maxToolsPerTurn: 12
})

const sessionId = engine.createSession()
const response = await engine.chat(sessionId, "schedule a meeting tomorrow at 2pm", {
  onToolCall: (call) => console.log("Calling:", call.name),
  onToolResult: (name, result) => console.log("Result:", result)
})
```

Full observability. Session management. Conversation history. Production-ready.

---

**[12/18]**

Writing a custom plugin takes ~20 lines of TypeScript.

```typescript
const weatherPlugin = definePlugin({
  name: "weather",
  description: "Get real-time weather",
  actions: [{
    name: "get_current_weather",
    description: "Get temperature and conditions for a city",
    parameters: z.object({ city: z.string() }),
    execute: async ({ city }) => {
      const res = await fetch(`https://wttr.in/${city}?format=j1`)
      return res.json()
    }
  }]
})
```

It's just TypeScript. No framework magic. No DSL to learn.

---

**[13/18]**

The web dashboard at agentbridge.cc lets you:

- Browse a searchable directory of agent-ready APIs
- Register and publish your own API
- Chat with any API directly in the browser
- Manage OAuth credentials securely (encrypted at rest)
- One-click Vercel deploy for self-hosting

---

**[14/18]**

Architecture: 7 independent packages in a monorepo.

- `@agentbridgeai/core` — engine, plugin registry, conversation manager
- `@agentbridgeai/openapi` — OpenAPI converter, manifest-to-plugin runtime
- `@agentbridgeai/llm` — Claude + OpenAI-compatible providers
- `@agentbridgeai/cli` — command-line interface
- `@agentbridgeai/sdk` — embed in your app
- `@agentbridgeai/mcp` — Model Context Protocol server
- `@agentbridgeai/web` — Next.js dashboard

Pick the pieces you need. Use them standalone or together.

---

**[15/18]**

What we're NOT doing:

- Not a hosted platform you depend on
- Not a proprietary format that locks you in
- Not a proxy that touches your API keys

The manifest spec is open. The runtime is open. The directory is just an index. Your API stays yours.

---

**[16/18]**

This started from a simple observation:

APIs are about to become the most important infrastructure on the internet — not for developers, but for agents.

If your API isn't agent-readable, it's becoming invisible.

AgentBridge is the open standard that changes that.

---

**[17/18]**

Things that work today:

✓ OpenAPI → manifest conversion (3.x + Swagger 2.0)
✓ Spotify, Gmail, Google Calendar with built-in OAuth
✓ Claude, GPT-4, Groq, Gemini, Ollama
✓ MCP server for Claude Desktop + Cursor + Windsurf
✓ Smart tool selection (no more 413 errors)
✓ Full CLI + web dashboard + TypeScript SDK
✓ Docker + Vercel self-hosting

MIT licensed. Contributions welcome.

---

**[18/18]**

If you're building:
- AI agents that call external APIs
- Developer tools for the agentic era
- APIs you want accessible to every agent

Star the repo, try the CLI, and open an issue if something doesn't work.

github.com/ranausmanai/AgentBridge

We read every issue.

---

## Supplementary Posts (Standalone, for replies or separate drops)

---

**[Standalone: The Demo]**

One command. Real API. Real agent.

```bash
npx agentbridge chat spotify
```

"Add the top 5 Radiohead songs to a new playlist called 'classics'"

Watch it:
1. Call `search_tracks` 5 times
2. Call `get_current_user` to resolve your Spotify ID
3. Call `create_playlist`
4. Call `add_tracks_to_playlist`

All autonomously. All correctly authenticated. Zero code written.

---

**[Standalone: For API Owners]**

If you maintain a public API, here's a 3-step checklist for the agentic era:

1. Generate your `.agentbridge.json` manifest: `npx agentbridge init`
2. Host it at `https://yourdomain.com/.well-known/agentbridge.json`
3. Submit to agentbridge.cc/publish

Done. Every AI agent that uses AgentBridge can now discover and call your API automatically.

---

**[Standalone: The Tech Insight]**

Why do most "AI + API" tools fail in production?

Token budget explosions. You load 50 API tools, the LLM context fills up, and everything breaks.

Our fix: relevance-based tool selection.

Every turn, we score your user's message against every available action. We only send the top K tools to the LLM — based on semantic overlap, not random picks.

Configurable per provider. Groq gets 6. Claude gets 12. You decide.

---

**[Standalone: Open Standard Pitch]**

The `.agentbridge.json` spec is public.

You don't need our runtime to use it. You don't need our directory to be discovered. You don't need our CLI to build on it.

It's a file format — like robots.txt, but for AI agents.

We think that's the right model for infrastructure. Open, decentralized, composable.

---
