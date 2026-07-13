# StoryMe — Security, Testing, CI/CD & Implementation Plan

## 1. Threat model (STRIDE-lite by surface)

| Surface | Threats | Controls |
|---|---|---|
| **Users/auth** | credential stuffing, session theft, account takeover | Supabase Auth, rate-limit + lockout, MFA (post-MVP), short-lived JWT + refresh, httpOnly cookies (web) / SecureStore (mobile), passkeys post-MVP, breach-password checks. |
| **APIs** | broken object-level auth (BOLA), mass assignment, injection | RLS + per-request authorization on every resource, Zod/class-validator DTOs, parameterized queries (ORM), allowlist fields, OWASP API Top 10 review. |
| **File uploads** | malware, oversized, MIME spoof, SSRF via URLs, biometric misuse | presigned direct upload, size/MIME allowlist, re-validate server-side, image re-encode (strip EXIF/GPS), (optional) AV scan, no server-side fetch of user URLs (SSRF), consent gate for face data. |
| **AI endpoints** | prompt injection, disallowed content, cost abuse, model DoS | server-only AI calls, input+output moderation, per-user quotas + rate limits, job idempotency, spend caps + alerts, no secrets/PII in prompts. |
| **Payments** | webhook forgery, replay, entitlement bypass | signature verification, idempotent event handling, entitlements server-side only, reconciliation, never trust client for grants. |
| **Mobile apps** | reverse engineering, token theft, insecure storage, deep-link hijack | no embedded secrets, SecureStore for tokens, cert-agnostic (no pinning bypass), validate deep links + universal-link domains, jailbreak/root awareness, screenshot protection on sensitive screens, app attestation (post-MVP). |
| **Admin** | privilege escalation, insider abuse | separate RBAC role, admin routes gated + audited, least privilege, SSO/MFA for admins, IP allowlist optional. |
| **3rd-party** | key leakage, supply chain | secrets in manager (not code), dependency + container scanning (Dependabot/Trivy), pinned deps, minimal scopes. |

## 2. Cross-cutting security controls
OWASP Top 10 + API Top 10 mapped: input validation (Zod both ends), output encoding
(React auto-escape), SQLi (ORM/parameterized), XSS (CSP, sanitize user text in
bubbles), CSRF (SameSite + token for cookie flows), SSRF (no user-controlled server
fetch), TLS everywhere, encryption at rest (Postgres + R2), secret management
(env + platform secret store, validated at boot via Zod), structured + PII-scrubbed
logging, audit logging, least-privilege DB roles, encrypted backups.

## 3. Compliance
GDPR/CCPA: consent, DSAR export + deletion endpoints, data minimization, DPA with
subprocessors. **BIPA** (biometric/face): explicit consent + retention/deletion
policy + no sale. **COPPA/GDPR-K** (children's photos): parental-consent gating,
avoid targeting <13, clear ToS. **PCI:** fully offloaded to Stripe/App stores.
App-store: content moderation + reporting + UGC policy required for approval.

## 4. Testing strategy (pyramid)
```
        E2E (few): Playwright web, Maestro mobile, critical money+generation paths
     Integration (some): API+DB+queue, webhook, auth, RLS, contract (OpenAPI)
  Unit (many): services, validation, entitlement math, AI adapters (mocked), utils
```
- **Web:** Vitest unit/component, Playwright E2E, axe accessibility, optional visual.
- **Mobile:** Jest + RN Testing Library, Maestro E2E, device matrix, release smoke.
- **Backend:** unit (services/rules), integration (test PG + Redis), contract tests
  vs OpenAPI, security tests (authz/RLS), load (k6) on generation path.
- **AI:** prompt regression (golden script outputs), structured-output schema
  validation, safety tests (disallowed prompts blocked), cost regression
  (tokens/panels within budget), fallback-model tests.
- **Definition of done:** typed, validated, tested (unit + relevant integration),
  authz enforced, errors handled + logged, docs/OpenAPI updated, feature-flagged if
  risky, no hardcoded secrets, CI green.

## 5. CI/CD (GitHub Actions)
- **Shared:** lint, typecheck, unit tests, dependency + secret scan on every PR;
  Turborepo remote cache for speed; only affected apps built.
- **Web/Admin:** build → Cloudflare Pages preview per PR → production on main.
- **API/Workers:** test → security scan → Docker build → migrate (expand/contract,
  gated) → deploy Cloud Run/Railway → health check → auto-rollback on failure.
- **Mobile:** lint/type/test → EAS build → internal channel → TestFlight / Play
  internal → manual approval → production; **OTA (EAS Update)** for JS-only fixes.
- **Envs:** dev → preview (per PR) → staging → production. **Branching:** trunk-based,
  short-lived PRs, protected `main`, required checks + review. **Releases:** semver +
  changesets; DB migrations reviewed; secrets via GitHub OIDC → platform secret store;
  approval gates on prod + migrations.

## 6. Observability
Structured JSON logs (pino) with request id + PII scrubbing; Sentry (web/API/mobile
crashes); OpenTelemetry traces API→worker→AI; metrics (Prometheus/Grafana or Better
Stack): request latency, job durations, queue depth, AI cost/tokens, DB pool.
Uptime (Uptime Kuma/Better Stack). **Alerts:** API 5xx spike, AI failure rate,
p95 latency, DB connection exhaustion, queue backlog, payment webhook failures,
mobile crash-free < threshold, **AI spend/day over budget**, storage errors,
auth failure spikes.

## 7. Implementation phases & running checklist

Build order (each phase: files → code → commands → env → migrations → tests → verify → DoD).

- [x] **Design:** architecture, scope, stack, cost, plan (this document set).
- [~] **Phase 1 — Monorepo init + shared config** (Turborepo, pnpm, tsconfig, eslint,
  prettier, env validation, design tokens, shared-types, validation schemas). ← in progress
- [ ] **Phase 2 — Database schema** (migrations, RLS, seed).
- [ ] **Phase 3 — Backend API** (NestJS modules, health, error envelope, OpenAPI).
- [ ] **Phase 4 — Authentication** (Supabase JWT guard, RBAC, refresh).
- [ ] **Phase 5 — Shared API SDK** (OpenAPI → typed client).
- [ ] **Phase 6 — Web app** (Next.js: landing, auth, dashboard, create flow, reader, billing).
- [ ] **Phase 7 — Mobile app** (Expo: auth, camera/upload, create flow, reader, push).
- [ ] **Phase 8 — Admin portal** (users, moderation, metrics, flags).
- [ ] **Phase 9 — Background workers** (BullMQ: story, image, assembly, notify; retries/DLQ).
- [ ] **Phase 10 — AI integration** (provider-agnostic layer, moderation, cost tracking).
- [ ] **Phase 11 — Payments** (Stripe + RevenueCat, entitlements, webhooks).
- [ ] **Phase 12 — Notifications** (email + push).
- [ ] **Phase 13 — Testing** (unit/integration/E2E/AI evals).
- [ ] **Phase 14 — CI/CD** (pipelines, envs, gates).
- [ ] **Phase 15 — Production deployment** (Docker, IaC, DNS/SSL/CDN, backups, store submission).

## 8. Shared-code strategy — realistic sharing
Shared (packages/): TS types, OpenAPI SDK, Zod validation, business/entitlement rules,
auth utils, analytics event names, feature-flag keys, constants, i18n resources,
design tokens, error models, AI request/response types. **Realistically ~30–40% of
total code** is shared (higher for logic-heavy backend+clients, lower once
platform-specific UI dominates). **Not shared:** web page components, native screens,
browser-only code, device integrations, platform navigation.
