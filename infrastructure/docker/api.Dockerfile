# Multi-stage build for the StoryMe API (NestJS). Build context = repo root.
#   docker build -f infrastructure/docker/api.Dockerfile -t storyme-api .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @storyme/api... build
RUN pnpm --filter @storyme/api --prod deploy /out

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /out/dist ./dist
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/v1/health || exit 1
CMD ["node", "dist/main.js"]
