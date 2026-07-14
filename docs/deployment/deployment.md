# StoryMe — Deployment Runbook

## MVP topology (low-cost)
| Component | Host (MVP) | Notes |
|---|---|---|
| Web + Admin | Cloudflare Pages | free tier, global CDN |
| API | Cloud Run / Railway (Docker) | `infrastructure/docker/api.Dockerfile` |
| Worker | Cloud Run (min-instances 1) / Railway | `infrastructure/docker/worker.Dockerfile` |
| Postgres | Supabase (free → Pro) | daily backups + PITR on Pro |
| Redis | Upstash (serverless) | BullMQ queue |
| Storage/CDN | Cloudflare R2 | zero egress |
| AI | Replicate (image) + Fireworks (text) | behind `@storyme/ai` |
| Mobile | Expo EAS | TestFlight + Play internal |

## Environment variables
Server secrets are validated at boot by `@storyme/config` (fail-fast). See
`.env.example` for the full list. Set them in the platform's secret manager
(never in the image). Minimum for API + worker: `DATABASE_URL`, `REDIS_URL`,
`SUPABASE_*`, `STORAGE_*`, `AI_*`, `STRIPE_*`.

## Database migrations
Forward-only SQL migrations in `packages/database/migrations`, applied by the
runner: `pnpm --filter @storyme/database migrate`. Run as a release step BEFORE
rolling out new API/worker (expand/contract for zero downtime). Seed dev only:
`pnpm --filter @storyme/database seed`.

## Deploy steps (API/worker)
1. CI builds + tests on PR; merge to `main`.
2. Build image: `docker build -f infrastructure/docker/api.Dockerfile -t $IMG .`
3. Push to registry; deploy to Cloud Run/Railway.
4. Run migrations (release phase).
5. Health check `/v1/health` + `/v1/ready`; auto-rollback on failure.

## Rollback
Redeploy the previous image tag. DB migrations are expand/contract so the prior
API version remains compatible; never drop columns in the same release that stops
using them.

## Backups & restore
Supabase automated daily backups + PITR (Pro). Restore: provision from PITR to a
point in time, repoint `DATABASE_URL`, redeploy. Test restore quarterly (runbook
in `docs/runbooks`). R2 objects are versioned via lifecycle policy.

## Mobile release
`eas build --platform all` → submit: `eas submit`. JS-only fixes ship via
`eas update` (OTA). See `docs/deployment` app-store checklist (post-MVP).

## Domains / DNS / SSL
Cloudflare-managed DNS; Pages + Cloud Run custom domains with automatic TLS.
API at `api.storyme.app`, web at `storyme.app`, CDN at `cdn.storyme.app` (R2).
