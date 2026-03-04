# RevenueCat x AgentBridge: 48-Hour Execution Playbook

## Goal
Publish a working RevenueCat API on AgentBridge, use it through Chat + MCP, and submit a public application letter for the Agentic AI Developer Advocate role.

## 0) Prerequisites
- Node.js 20+
- Latest CLI + MCP:
  - `npm i -g @agentbridgeai/cli@latest @agentbridgeai/mcp@latest`
- RevenueCat secret API key (from your RevenueCat project)

## 1) Import RevenueCat API and Generate Manifest
RevenueCat OpenAPI URL (validated):
- `https://www.revenuecat.com/docs/redocusaurus/plugin-redoc-0.yaml`

Run in a clean folder:

```bash
mkdir -p ~/revenuecat-agentbridge
cd ~/revenuecat-agentbridge
agentbridge init --spec https://www.revenuecat.com/docs/redocusaurus/plugin-redoc-0.yaml
```

Notes:
- This creates `.agentbridge.json`.
- `--yes` works, but it may auto-publish immediately. Use interactive mode for control.

## 2) Publish to AgentBridge Directory
From the same folder:

```bash
agentbridge publish
```

Recommended for first run:
- Start with `private`
- Once validated, publish `public`

## 3) Set RevenueCat Auth in CLI
The imported RevenueCat API uses bearer auth.

```bash
agentbridge auth developer-api --token YOUR_REVENUECAT_SECRET_API_KEY
```

Then test:

```bash
agentbridge chat developer-api
```

Example prompts:
- `List my RevenueCat projects`
- `Show apps in project <project_id>`
- `List customers in project <project_id> limit 10`

## 4) MCP Setup (Claude/Codex/Cursor/Windsurf)
Guided setup:

```bash
agentbridge mcp setup developer-api
```

This handles install/auth/client config guidance and health checks.

## 5) Public Application Letter (Required by RevenueCat)
Publish a public URL (GitHub Gist, GitHub Pages, blog post) answering:

> How will the rise of agentic AI change app development and growth over the next 12 months, and why are you the right agent to be RevenueCat’s first Agentic AI Developer & Growth Advocate?

Keep it concrete:
- 1 live AgentBridge + RevenueCat demo
- 3 workflows (technical + growth)
- 1 measurable 30-day plan

## 6) Suggested 30-Day Plan to Include in Letter
- 2 technical/growth posts per week
- 1 growth experiment per week
- 50+ community interactions per week
- 3 structured product feedback items per week
- Weekly async report with metrics

## 7) Immediate Smoke-Test Checklist
- `.agentbridge.json` generated
- API published on `agentbridge.cc`
- `agentbridge auth` saved
- `agentbridge chat developer-api` can call read endpoints
- `agentbridge mcp setup developer-api` completed
- Public application letter URL submitted

