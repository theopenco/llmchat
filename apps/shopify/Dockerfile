# Multi-stage pnpm build, pinned by this app's own pnpm-lock.yaml
# (apps/shopify is a standalone pnpm workspace — build from this directory:
#   docker build -t clanker-shopify apps/shopify
# ). Runtime needs: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL,
# SCOPES="" and DATABASE_URL pointing at a volume-backed file, e.g.
#   DATABASE_URL="file:/data/prod.sqlite"  with a volume mounted at /data
# — see .env.example. Migrations run on boot (docker-start → prisma migrate
# deploy), so first start creates the schema.

FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
# corepack prepare pins pnpm from "packageManager" at image-build time so the
# runtime never fetches it from the network.
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate && pnpm run build:app
# Drop devDependencies (@shopify/cli alone is most of the tree).
RUN pnpm prune --prod

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["pnpm", "run", "docker-start"]
