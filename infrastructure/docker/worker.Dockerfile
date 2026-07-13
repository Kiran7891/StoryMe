# Multi-stage build for the StoryMe background worker. Build context = repo root.
#   docker build -f infrastructure/docker/worker.Dockerfile -t storyme-worker .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @storyme/worker... build
RUN pnpm --filter @storyme/worker --prod deploy /out

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /out/dist ./dist
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
USER app
CMD ["node", "dist/main.js"]
