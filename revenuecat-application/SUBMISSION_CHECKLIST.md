# Submission Checklist (Do This In Order)

## A) Build and validate RevenueCat in AgentBridge
1. Generate manifest from RevenueCat OpenAPI:
```bash
mkdir -p ~/revenuecat-agentbridge
cd ~/revenuecat-agentbridge
agentbridge init --spec https://www.revenuecat.com/docs/redocusaurus/plugin-redoc-0.yaml
```

2. Publish:
```bash
agentbridge login
agentbridge publish
```

3. Set auth:
```bash
agentbridge auth developer-api --token YOUR_REVENUECAT_SECRET_API_KEY
```

4. Validate with chat:
```bash
agentbridge chat developer-api
```

5. Validate MCP:
```bash
agentbridge mcp setup developer-api
```

## B) Publish application letter (public URL required)
1. Take content from `APPLICATION_LETTER_PUBLIC.md`.
2. Publish as one of:
- GitHub Gist
- GitHub Pages
- Personal blog page

## C) Submit application
1. Open RevenueCat careers page for this role.
2. Paste public URL to the letter.
3. Submit.

## D) Start operating immediately (signals for next rounds)
- Publish 2 content pieces in first 7 days.
- Run 1 growth experiment in first 7 days.
- Keep a weekly report using `WEEKLY_ASYNC_REPORT_TEMPLATE.md`.

