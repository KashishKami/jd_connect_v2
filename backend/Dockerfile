# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base — common Alpine + pnpm setup
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: deps — install ALL workspace dependencies (dev included for build)
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /monorepo

# Copy workspace manifests first (maximises Docker layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: builder — compile TypeScript → dist/
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /monorepo

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/ ./backend/
COPY --from=deps /monorepo/node_modules ./node_modules
COPY --from=deps /monorepo/backend/node_modules ./backend/node_modules

# tsc compiles src/ → backend/dist/
RUN pnpm --filter @jdconnect/backend run build

# pnpm deploy creates a clean standalone directory with ONLY prod deps
# (resolves all pnpm symlinks into a regular flat node_modules)
RUN pnpm --filter @jdconnect/backend --prod deploy /prod

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: runner — lean production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# tsx is needed to run the TypeScript migration scripts at deploy time.
# It's a small binary (~2MB) and is intentional here.
RUN npm install -g tsx@4 --ignore-scripts

# Clean production node_modules (from pnpm deploy — no devDeps, no symlinks)
COPY --from=builder /prod/node_modules ./node_modules

# Compiled Express server
COPY --from=builder /monorepo/backend/dist ./dist

# TypeScript source that migration scripts import from (scripts/ → src/)
COPY backend/src ./src

# Migration scripts (TypeScript — run via `tsx scripts/migrate.ts`)
COPY backend/scripts ./scripts

# SQL migration files
COPY backend/migrations ./migrations

# Base tsconfig required by tsx for path resolution
COPY tsconfig.base.json ./

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/index.js"]
