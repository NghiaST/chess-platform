# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Copy prisma schema before npm ci so postinstall (prisma generate) can run
COPY prisma ./prisma/
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*

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

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
