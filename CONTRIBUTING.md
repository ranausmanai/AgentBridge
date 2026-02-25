# Contributing to AgentBridge

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/ranausmanai/AgentBridge.git
cd AgentBridge
pnpm install
pnpm build
```

## Project Structure

```
packages/
  core/       # Engine, plugin registry, conversation manager
  llm/        # LLM providers (Claude, GPT, Groq, OpenAI-compatible)
  openapi/    # OpenAPI → agent-ready manifest converter
  sdk/        # SDK for building custom plugins
  mcp/        # MCP server for Claude Desktop, Cursor, etc.
  cli/        # CLI tool
apps/
  web/        # Next.js web dashboard
plugins/
  weather/    # Example weather plugin
  todo/       # Example todo plugin
```

## Development

```bash
# Run the web dashboard in dev mode
cd apps/web && pnpm dev

# Build all packages
pnpm build

# Build a specific package
pnpm --filter @agentbridge/core build
```

## Pull Requests

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Ensure `pnpm build` passes
4. Submit a pull request

## Areas for Contribution

- New LLM providers (Gemini, Mistral, etc.)
- New example plugins
- Documentation improvements
- Bug fixes
- Performance improvements

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
