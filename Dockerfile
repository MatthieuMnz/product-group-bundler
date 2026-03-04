# ── Builder stage ──────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY extensions/product-configuration/package.json extensions/product-configuration/
COPY extensions/bundle-action/package.json extensions/bundle-action/
COPY extensions/cart-transformer/package.json extensions/cart-transformer/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────
FROM node:22-alpine

RUN corepack enable pnpm
RUN apk add --no-cache openssl

ENV NODE_ENV=production

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY extensions/product-configuration/package.json extensions/product-configuration/
COPY extensions/bundle-action/package.json extensions/bundle-action/
COPY extensions/cart-transformer/package.json extensions/cart-transformer/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/build ./build
COPY prisma ./prisma

RUN mkdir -p /data

EXPOSE 3100

CMD ["pnpm", "run", "docker-start"]
