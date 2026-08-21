# portal/Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build:
#   Stage 1 (builder) — installs pnpm workspace deps, runs esbuild to produce
#                       dist/bundle.js, dist/styles.css, dist/index.html.
#   Stage 2 (runtime) — copies the compiled dist/ into nginx:alpine. nginx
#                       serves the portal as a static file server on port 80.
#
# BACKEND_URL is passed as a Docker build arg and baked into bundle.js by esbuild.
# Set it to the URL the BROWSER will use to reach the backend API:
#   - Local Docker test:  http://localhost:4001
#   - Production:         https://api.yourcompany.com
#
# API calls go directly from the browser to the backend (absolute URL in bundle.js).
# CORS is handled by the backend's ALLOWED_CORS_ORIGINS env var — same approach
# used by the old attendance-app and hr-dashboard before Phase 10.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifest files first (layer-cache friendly)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy only the portal package manifest
COPY portal/package.json ./portal/

# Install portal dependencies only
RUN pnpm install --frozen-lockfile --filter @jdconnect/portal

# Copy portal source
COPY portal/ ./portal/

# BACKEND_URL is declared as an ARG so it becomes available as an env var
# during the RUN step. build.mjs reads process.env.BACKEND_URL first, so
# whatever is passed here via --build-arg is what esbuild bakes into bundle.js.
ARG BACKEND_URL=http://127.0.0.1:4000

# Run esbuild — produces dist/bundle.js, dist/styles.css, dist/index.html
RUN pnpm --filter @jdconnect/portal build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy compiled static assets from builder stage
COPY --from=builder /app/portal/dist /usr/share/nginx/html

# Simple nginx config: serve static files only.
# Falls back to index.html for all unknown routes (client-side routing).
# No /api/* proxy block — API calls go directly from the browser to the backend.
RUN printf "\
server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Security headers\n\
    add_header X-Frame-Options SAMEORIGIN;\n\
    add_header X-Content-Type-Options nosniff;\n\
    server_tokens off;\n\
\n\
    # Serve static assets; fall back to index.html for client-side routes\n\
    location / {\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
}\n\
" > /etc/nginx/conf.d/default.conf

EXPOSE 80
