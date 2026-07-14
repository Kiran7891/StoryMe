# StoryMe — Open-Source AI Strategy, Cost & Scaling

## 1. AI capabilities required

| Capability | Purpose |
|---|---|
| **Text/story generation** | Turn user prompt → structured comic script (panels, scene descriptions, dialogue, captions). |
| **Character identity conditioning** | Preserve the uploaded person's likeness across panels. |
| **Panel image generation** | Render each panel in chosen art style, conditioned on identity + scene. |
| **Moderation** | Screen input photos & prompts and output images for disallowed content. |
| **(Optional) Embeddings** | Face/style similarity, dedup, retrieval — pgvector. |

## 2. Story/text model comparison

| Option | Quality | Latency | Cost | License | Notes |
|---|---|---|---|---|---|
| **Llama 3.3 70B (hosted: Fireworks/Together)** | High for structured JSON script | ~2–5s | ~$0.20–0.90 / 1M tok | Llama Community (commercial OK) | **MVP pick** — pay-per-token, no GPU ops. |
| Qwen2.5 72B (hosted) | Comparable, strong JSON | similar | similar | Apache-2.0 (cleaner license) | Strong alt / primary. |
| Self-host Llama/Qwen on vLLM | High | fast batched | GPU $/hr (idle cost) | OK | Only worth it at high, steady volume. |
| GPT-4o-mini / Claude Haiku (fallback) | High | fast | ~$0.15–0.60/1M | proprietary | **Fallback** for reliability/quality edge. |

Story gen is cheap (a few thousand tokens/comic → fractions of a cent). **Not the cost driver.**

## 3. Image generation — the cost driver & the hard part

Character consistency options:

| Approach | Likeness | Cost/latency | Verdict |
|---|---|---|---|
| **SDXL + InstantID / IP-Adapter FaceID** | Good, single ref, no training | ~5–15s/img on A100, cheap | **MVP pick** — no per-user training. |
| FLUX.1 + PuLID / InstantID | Higher quality | pricier GPU/mem | Post-MVP quality tier. |
| Per-user **LoRA/DreamBooth** | Best fidelity | 5–20 min training + storage/user | Scale / premium tier only. |
| SD 3.x | Good, license terms | check commercial terms | Evaluate; licensing caution. |

**Licenses:** SDXL (CreativeML OpenRAIL++ — commercial OK), FLUX.1 [dev]
(non-commercial — must use [pro]/[schnell]-Apache or license), InstantID (Apache-2.0),
IP-Adapter (Apache-2.0). **Verify current terms before launch.**

Serving for image: **hosted GPU (Replicate)** at MVP (pay per second, zero idle),
migrate to **RunPod/Modal serverless GPU** then **dedicated GPU** as volume grows.
Local dev: **ComfyUI + Ollama**.

## 4. Moderation
- Input: perceptual/NSFW image classifier + prompt policy filter (open models e.g.
  NSFW detectors; proprietary vision moderation as fallback). Block minors-in-unsafe,
  celebrities-as-others, explicit, violence-to-real-person.
- Output: re-scan generated panels before delivery.
- Human review queue in admin for flagged items.

## 5. Cost model & break-even

**Assumptions:** 1 comic = 7 panels. Image gen ≈ 8s GPU each.

| Serving mode | ~Cost / panel | ~Cost / comic (7) | Idle cost | Best when |
|---|---|---|---|---|
| Replicate (per-sec hosted) | $0.01–0.04 | **$0.07–0.28** | none | **MVP / spiky** |
| Serverless GPU (Modal/RunPod) | $0.005–0.02 | $0.04–0.14 | low (cold starts) | Growth / medium steady |
| Dedicated A100 ($1.5–2/hr) | depends on util | ~$0.02–0.06 at high util | **high if idle** | High steady volume |
| Self-host owned GPU | lowest/req at scale | — | capex + ops | Very high, predictable |

**Break-even (dedicated vs hosted):** one A100 ≈ $1,100–1,500/mo. At ~$0.15/comic
hosted, break-even ≈ **7k–10k comics/mo of steady load** before a dedicated GPU
wins — *and only if utilization stays high*. **Do not self-host GPU at MVP.**

Text gen adds < $0.01/comic. Moderation ~ $0.001–0.01/comic. Storage/CDN via R2 =
negligible egress. **Blended target COGS ≈ $0.10–0.35 / comic** → price a comic /
credit well above this (e.g. free tier limited; paid comic effective price $0.50–2+).

## 6. Monthly cost estimates

Ranges; AI scales with *comics generated*, not raw MAU. Assume ~30% of MAU generate
~2 comics/mo.

| Stage | Web/CDN | API+Workers | DB | Redis | Storage | AI (image+text) | Email/Push | Obs/Analytics | **Total (~)** |
|---|---|---|---|---|---|---|---|---|---|
| Local dev | $0 | $0 | $0 (local/Supabase free) | $0 | $0 | $0 | $0 | $0 | **$0** |
| Private beta (~100) | $0 (CF free) | $5–15 | $0 (free) | $0 (Upstash free) | ~$1 | $20–50 | $0 | $0–10 | **$40–75** |
| 1k MAU | $0–20 | $20–40 | $25 (Supabase Pro) | $0–10 | $2–5 | $150–350 | $5 | $10–30 | **$350–550** |
| 10k MAU | $20–50 | $80–200 | $25–100 | $10–30 | $10–30 | $1.5k–4k | $20–50 | $50–150 | **$2k–5k** |
| 100k MAU | $100–300 | $500–1.5k | $200–600 | $50–150 | $50–200 | $15k–40k | $100–400 | $300–800 | **$18k–45k** |
| 1M MAU | $500–2k | $3k–10k (autoscale/dedicated) | $1k–4k (replicas) | $300–1k | $500–2k | $120k–350k (dedicated GPU fleet) | $500–2k | $2k–6k | **$130k–380k** |

**Most expensive component at every paid stage: AI image inference.** Cost-reduction
levers: dedicated GPUs at high steady load, batching, smaller/faster models, caching
identical requests, panel-count limits per tier, aggressive free-tier limits, cheaper
providers, distillation/turbo schedulers (SDXL-Turbo/LCM) to cut steps.

## 7. Scaling roadmap

**Phase 1 — MVP:** modular monolith + BullMQ workers; Supabase PG; Upstash Redis;
R2; **hosted GPU (Replicate)**; Cloudflare Pages + Cloud Run/Railway.
Trigger to move on: > ~5–8k comics/mo or GPU spend > dedicated break-even, or
p95 latency from cold starts hurts UX.

**Phase 2 — Growth:** dedicated worker pool; serverless GPU (Modal/RunPod) or 1–2
dedicated GPUs behind the AI layer with autoscale; Redis managed; DB read replica
for admin/analytics; result caching; model routing (fast vs quality tiers);
tested backups + PITR. Trigger: sustained GPU utilization, DB CPU, queue backlog.

**Phase 3 — High scale:** horizontal API autoscaling; Postgres read replicas +
partitioning on high-volume tables (jobs, images); regional deployment + regional
GPU; dedicated GPU fleet with queue-based autoscaling; extract AI-orchestration
service; advanced observability + DR automation (multi-region, RPO/RTO targets).

Each phase keeps the **same OpenAPI contract** and **provider-agnostic AI layer**,
so clients never change and no rewrite is required.
