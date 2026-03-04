# RevenueCat Is Agent-Ready in 15 Minutes (OpenAPI -> Chat -> MCP)

If agents are shipping apps, monetization infrastructure has to be agent-usable.

This guide shows how to take RevenueCat's API and make it directly usable by AI agents through AgentBridge.

## Why this matters
Most teams still expose docs for humans and expect manual integration work.
Agent-driven workflows need:
- machine-readable API contracts,
- runtime tool wiring,
- and operational interfaces (chat/CLI/MCP).

## Step 1: Generate an agent manifest
```bash
mkdir -p ~/revenuecat-agentbridge
cd ~/revenuecat-agentbridge
agentbridge init --spec https://www.revenuecat.com/docs/redocusaurus/plugin-redoc-0.yaml
```

This generates `.agentbridge.json` with actions mapped from RevenueCat OpenAPI.

## Step 2: Publish for discovery
```bash
agentbridge login
agentbridge publish
```

Now the API can be discovered and used from the AgentBridge ecosystem.

## Step 3: Configure auth
```bash
agentbridge auth developer-api --token YOUR_REVENUECAT_SECRET_API_KEY
```

## Step 4: Use it via chat
```bash
agentbridge chat developer-api
```

Example prompts:
- `List my projects`
- `List apps in project <project_id>`
- `Show overview metrics for project <project_id> in USD`

## Step 5: Use it as MCP tools
```bash
agentbridge mcp setup developer-api
```

Then Claude/Codex/Cursor can call RevenueCat endpoints as tools.

## Practical outcome
You now have a working agent runtime over RevenueCat's API:
- no hand-written wrappers,
- no custom orchestration layer,
- reproducible setup for every team member.

## What this enables next
- Weekly automated growth briefs from RevenueCat metrics
- Agent-run experiment loops for pricing/paywall decisions
- Structured product feedback from real API usage patterns

