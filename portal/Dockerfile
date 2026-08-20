# portal/Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build:
#   Stage 1 (builder) — installs pnpm workspace deps, runs esbuild to produce
#                       dist/bundle.js, dist/styles.css, dist/index.html.
#   Stage 2 (runtime) — copies the compiled dist/ into nginx:alpine. nginx
#                       serves the portal on port 80 AND reverse-proxies all
#                       /api/* requests to the backend API container.
#
# Because portal/src/lib/api.ts uses relative paths (/api/...), no BACKEND_URL
# is baked into the frontend bundle. Instead, nginx routes /api/* to the
# backend via the BACKEND_INTERNAL_URL build-arg (the Docker-internal URL,
# e.g. http://api:4000 in the compose network).
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

# Run esbuild — produces dist/bundle.js, dist/styles.css, dist/index.html
RUN pnpm --filter @jdconnect/portal build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# The Docker-internal URL of the backend API service.
# In the compose network this is typically http://api:4000.
# Override at build time via --build-arg BACKEND_INTERNAL_URL=http://api:4000
ARG BACKEND_INTERNAL_URL=http://api:4000

# Copy compiled static assets from builder stage
COPY --from=builder /app/portal/dist /usr/share/nginx/html

# Write nginx config:
#   - Serves portal static files on port 80
#   - Reverse-proxies /api/* to the backend API container
#   - All unknown routes fall back to index.html (client-side routing)
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
    # Reverse-proxy all /api/* requests to the backend container.\n\
    # This avoids CORS issues and means the frontend never needs to know\n\
    # the backend's public URL — it always calls /api/... relative to its own origin.\n\
    location /api/ {\n\
        proxy_pass ${BACKEND_INTERNAL_URL}/api/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
\n\
    # Serve static assets; fall back to index.html for client-side routes\n\
    location / {\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
}\n\
" > /etc/nginx/conf.d/default.conf

EXPOSE 80
