# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
# Copy prisma schema before npm ci so postinstall (prisma generate) can run
COPY prisma ./prisma/
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

# Tell Prisma exactly which engine binary to use (bypasses broken auto-detection on Alpine)
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

WORKDIR /app

# Install production deps only, skip postinstall (prisma generate)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy Prisma schema + generated client from builder
COPY prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Create logs directory
RUN mkdir -p logs

EXPOSE 4000

CMD ["node", "dist/server.js"]
