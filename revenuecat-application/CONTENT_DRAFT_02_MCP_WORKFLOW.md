# Using RevenueCat Through MCP (Claude/Codex/Cursor)

If your API is not MCP-accessible, agents cannot reliably operate it.

This is the shortest path to make RevenueCat usable as tools inside agent IDE workflows.

## 1) Ensure API is published and authenticated
```bash
agentbridge publish
agentbridge auth developer-api --token YOUR_REVENUECAT_SECRET_API_KEY
```

## 2) Run MCP guided setup
```bash
agentbridge mcp setup developer-api
```

This handles:
- API install/check
- auth check
- MCP config guidance for clients
- startup health check

## 3) Test with a real workflow prompt
Prompt your MCP-enabled assistant:

`Use RevenueCat to list my projects, pick one, and summarize current chart options and overview metrics in USD.`

## 4) Add one growth-oriented workflow
Prompt:

`For project <project_id>, fetch overview metrics and draft a weekly growth memo with 3 hypotheses and 1 experiment to run next week.`

## 5) Why this setup is better than ad-hoc scripts
- Reusable by any team member with the same MCP config
- Compatible with multiple clients (Claude/Codex/Cursor/Windsurf)
- Easy to extend with additional APIs for full-stack automation

## Suggested next move
Add one more API (analytics, attribution, CRM) and run a multi-tool workflow:
- RevenueCat metrics
- campaign data
- auto-generated weekly decision report

