# StoryMe

> Turn your photos into personalized comic stories. Upload a few photos, describe a
> story, pick an art style — and get a shareable comic book starring someone you
> know, in minutes. No drawing skills required.

StoryMe is a cross-platform product (responsive web + native iOS/Android + admin
portal) built as a **modular monolith with background workers** in a Turborepo
monorepo. It is designed to launch cheaply and scale without a rewrite.

## Documentation

| Doc | Contents |
|---|---|
| [Product & Architecture](docs/architecture/01-product-and-architecture.md) | Vision, scope, feature matrix, architecture + Mermaid diagrams, stack. |
| [AI Strategy & Cost](docs/architecture/02-ai-and-cost.md) | Open-source AI models, character consistency, break-even, cost by scale, roadmap. |
| [Database & API](docs/architecture/03-database-and-api.md) | ER diagram, schema conventions, credits ledger, REST endpoints, versioning. |
| [Security, Testing, CI/CD & Plan](docs/security/threat-model-and-controls.md) | Threat model, controls, compliance, testing pyramid, pipelines, phase checklist. |

## Monorepo layout

```
apps/
  web/       Next.js customer web app + marketing site
  mobile/    Expo (React Native) iOS + Android
  admin/     Next.js internal admin portal
  api/       NestJS modular-monolith REST API
  worker/    BullMQ background workers (AI, media, notify)
packages/
  shared-types/    Enums, error model, constants, analytics/flag keys
  validation/      Zod schemas shared by API + clients
  config/          Zod-validated environment loading
  design-tokens/   Brand tokens for web + mobile
  api-client/      Generated typed SDK (OpenAPI) — added in Phase 5
  auth/            Shared auth utilities — added in Phase 4
  ui-web/          shadcn/ui components — added in Phase 6
  ui-mobile/       NativeWind components — added in Phase 7
  ai/              Provider-agnostic AI service layer — added in Phase 10
  eslint-config/   Shared flat ESLint config
  typescript-config/ Shared tsconfig presets
infrastructure/  docker/ terraform/ github-actions/ monitoring/
docs/            architecture/ api/ deployment/ security/ runbooks/
```

## Getting started

```bash
# Prereqs: Node >= 20.11, pnpm >= 9, Docker (for local Postgres + Redis)
corepack enable
pnpm install
cp .env.example .env   # fill in values (defaults use AI mock providers)

pnpm typecheck         # type-check all packages
pnpm test              # run unit tests
pnpm lint              # lint all packages
pnpm build             # build everything via Turborepo
```

## Build status (running checklist)

- [x] Design: architecture, scope, stack, cost, plan
- [x] **Phase 1** — Monorepo init + shared config packages
- [x] **Phase 2** — Database schema (migrations, RLS, triggers, seed) — validated on Postgres 16
- [x] **Phase 3** — Backend API (NestJS, 28 endpoints, OpenAPI) — booted + verified on Postgres
- [x] **Phase 4** — Authentication (JWT verify, RBAC, RLS-scoped queries)
- [x] **Phase 5** — Shared typed API SDK (@storyme/api-client)
- [x] **Phase 6** — Web app (Next.js: landing/SEO, auth, feed, create flow, reader) — builds
- [x] **Phase 7** — Mobile app (Expo/React Native: auth, feed, create w/ camera roll, reader) — typechecks
- [x] **Phase 8** — Admin portal (Next.js: metrics, moderation queue, users) — builds
- [x] **Phase 9** — Background workers (BullMQ pipeline) — verified vs Postgres + Redis
- [x] **Phase 10** — AI service layer (provider-agnostic, mock+Fireworks+Replicate)
- [x] **Phase 11** — Payments (Stripe + RevenueCat webhooks, idempotent entitlements)
- [x] **Phase 12** — Notifications (Expo push + Resend email, wired to worker)
- [x] **Phase 13** — Testing (unit + integration across packages; CI-run)
- [x] **Phase 14** — CI/CD (GitHub Actions: build, lint, typecheck, test w/ Postgres, security scan)
- [x] **Phase 15** — Deployment (Dockerfiles, runbook, CI); app-store submission via EAS

### Final-product completion (post-phase hardening)

- [x] **Reels** end-to-end — `format` on create (web + mobile), worker assembles a
  1080×1920 H.264 MP4 via ffmpeg; verified producing a valid 10s vertical video
- [x] **Notifications API** — list, mark-read, mark-all-read
- [x] **Content reports** — report comics/comments into the admin moderation queue
- [x] **GDPR jobs** — account-deletion purge (media + rows) and data-export bundle
- [x] **Local storage driver** (`STORAGE_DRIVER=local`) for self-host / full-stack dev
- [x] **Full-chain E2E verified** — real HTTP API → Redis/BullMQ → worker → ffmpeg →
  storage → Postgres: a book and a reel generate end to end, credits debit,
  notifications fire, sharing + public read work

### Production hardening (final)

- [x] **Idempotency-Key enforced server-side** — claim-first interceptor: replayed
  responses for repeated keys, 409 for in-flight duplicates, claim release on
  failure (verified live: double-submit → one comic, one charge)
- [x] **Rate limiting** — global throttle + 10/min cap on AI generation (verified 429)
- [x] **Structured logging** — pino JSON request logs with secret redaction
- [x] **Brand art in-repo** — AI-generated hero image, 5-style character strip, and
  app icon (Higgsfield), fetched and committed by CI
- [x] **Release config** — EAS build profiles, complete .env.example

## License

Proprietary — © StoryMe. All rights reserved.
