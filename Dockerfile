FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy all package.json files
COPY packages/core/package.json packages/core/
COPY packages/llm/package.json packages/llm/
COPY packages/openapi/package.json packages/openapi/
COPY packages/sdk/package.json packages/sdk/
COPY packages/mcp/package.json packages/mcp/
COPY packages/cli/package.json packages/cli/
COPY plugins/weather/package.json plugins/weather/
COPY plugins/todo/package.json plugins/todo/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY plugins/ plugins/
COPY apps/web/ apps/web/

# Supabase env vars needed at build time for Next.js NEXT_PUBLIC_* inlining
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build packages in dependency order, then Next.js app
RUN pnpm --filter @agentbridge/core build && \
    pnpm --filter @agentbridge/llm build && \
    pnpm --filter @agentbridge/openapi build && \
    pnpm --filter @agentbridge/sdk build && \
    pnpm --filter @agentbridge/web build

# ---- Production image ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Copy standalone server (includes node_modules)
COPY --from=base /app/apps/web/.next/standalone ./

# Copy static assets
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static

# Data directory for SQLite
VOLUME /app/apps/web/data
ENV DATABASE_PATH=/app/apps/web/data/agentbridge.db

CMD ["node", "apps/web/server.js"]
