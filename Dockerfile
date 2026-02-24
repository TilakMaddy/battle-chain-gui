# Stage 1: Install Foundry (rarely changes — cached aggressively)
FROM node:22-alpine AS foundry
RUN apk add --no-cache curl bash git
ENV FOUNDRY_DIR="/opt/foundry"
ENV SHELL="/bin/bash"
RUN curl -L https://foundry.paradigm.xyz | bash \
    && ${FOUNDRY_DIR}/bin/foundryup

# Stage 2: Install Node dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy only what next build needs
COPY package.json ./
COPY src ./src
COPY public ./public
COPY next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs components.json ./

# Generate placeholder .env inline — no external .env file needed.
# The entrypoint replaces these __*__ tokens with real values at runtime.
RUN printf '%s\n' \
  'NEXT_PUBLIC_RPC_URL=__NEXT_PUBLIC_RPC_URL__' \
  'NEXT_PUBLIC_CHAIN_ID=__NEXT_PUBLIC_CHAIN_ID__' \
  'NEXT_PUBLIC_EXPLORER_URL=__NEXT_PUBLIC_EXPLORER_URL__' \
  'NEXT_PUBLIC_ATTACK_REGISTRY=__NEXT_PUBLIC_ATTACK_REGISTRY__' \
  'NEXT_PUBLIC_SAFE_HARBOR_REGISTRY=__NEXT_PUBLIC_SAFE_HARBOR_REGISTRY__' \
  'NEXT_PUBLIC_AGREEMENT_FACTORY=__NEXT_PUBLIC_AGREEMENT_FACTORY__' \
  'NEXT_PUBLIC_BATTLECHAIN_DEPLOYER=__NEXT_PUBLIC_BATTLECHAIN_DEPLOYER__' \
  > .env

RUN npm run build

# Stage 4: Production runner
FROM node:22-alpine AS runner

# Copy only the Foundry binaries from the foundry stage
COPY --from=foundry /opt/foundry/bin /opt/foundry/bin
ENV PATH="/opt/foundry/bin:${PATH}"

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy standalone output (owned by nextjs so entrypoint can sed the JS files)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Entrypoint: replaces __PLACEHOLDER__ tokens in compiled JS with runtime env vars.
# Self-hosters set clean names (RPC_URL, CHAIN_ID, etc.) — mapped here.
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -e' \
  'replace_env() {' \
  '  local placeholder="$1"' \
  '  local value="$2"' \
  '  if [ -n "$value" ]; then' \
  '    find /app/.next -name "*.js" -exec sed -i "s|${placeholder}|${value}|g" {} +' \
  '  fi' \
  '}' \
  'replace_env "__NEXT_PUBLIC_RPC_URL__"              "$RPC_URL"' \
  'replace_env "__NEXT_PUBLIC_CHAIN_ID__"             "$CHAIN_ID"' \
  'replace_env "__NEXT_PUBLIC_EXPLORER_URL__"         "$EXPLORER_URL"' \
  'replace_env "__NEXT_PUBLIC_ATTACK_REGISTRY__"      "$ATTACK_REGISTRY"' \
  'replace_env "__NEXT_PUBLIC_SAFE_HARBOR_REGISTRY__" "$SAFE_HARBOR_REGISTRY"' \
  'replace_env "__NEXT_PUBLIC_AGREEMENT_FACTORY__"    "$AGREEMENT_FACTORY"' \
  'replace_env "__NEXT_PUBLIC_BATTLECHAIN_DEPLOYER__" "$BATTLECHAIN_DEPLOYER"' \
  'exec "$@"' \
  > entrypoint.sh && chmod +x entrypoint.sh

# Create db directory for SQLite persistence
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
