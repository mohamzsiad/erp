# ═══════════════════════════════════════════════════════════════════════════════
# CloudERP Backend — Multi-stage Dockerfile
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

LABEL stage=builder

# Build args for traceability
ARG BUILD_SHA=unknown
ARG BUILD_VERSION=unknown

WORKDIR /build

# Install build tools (needed for some native modules)
RUN apk add --no-cache python3 make g++

# Copy workspace manifests first (layer cache)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json       ./packages/shared/
COPY packages/backend/package.json      ./packages/backend/

# Install all workspace dependencies
RUN npm ci --workspaces --if-present

# Copy source files
COPY packages/shared/    ./packages/shared/
COPY packages/backend/   ./packages/backend/

# Generate Prisma client
RUN cd packages/backend && npx prisma generate

# Compile TypeScript
RUN cd packages/backend && npx tsc --project tsconfig.json

# Prune dev dependencies for the runner stage
RUN npm prune --omit=dev --workspaces --if-present


# ── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

LABEL org.opencontainers.image.title="CloudERP Backend"
LABEL org.opencontainers.image.description="CloudERP Fastify API server"
LABEL org.opencontainers.image.source="https://github.com/your-org/clouderp"

# Install curl for health check, dumb-init for proper signal handling
RUN apk add --no-cache curl dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy compiled output and production node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /build/packages/backend/dist/           ./dist/
COPY --from=builder --chown=nodejs:nodejs /build/packages/backend/node_modules/   ./node_modules/
COPY --from=builder --chown=nodejs:nodejs /build/packages/shared/dist/            ./packages/shared/dist/
COPY --from=builder --chown=nodejs:nodejs /build/packages/shared/node_modules/    ./packages/shared/node_modules/

# Copy Prisma schema and generated client (required at runtime)
COPY --from=builder --chown=nodejs:nodejs /build/packages/backend/prisma/         ./prisma/
COPY --from=builder --chown=nodejs:nodejs /build/node_modules/.prisma/            ./node_modules/.prisma/
COPY --from=builder --chown=nodejs:nodejs /build/node_modules/@prisma/            ./node_modules/@prisma/

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    BUILD_SHA=${BUILD_SHA} \
    BUILD_VERSION=${BUILD_VERSION}

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check — fails fast (30s start period for DB connection)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Use dumb-init to handle signals properly (PID 1 reaping, SIGTERM forwarding)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
