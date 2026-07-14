# Brand assets

AI-generated brand art (Higgsfield). The UI degrades gracefully when a file is
missing (`BrandImage`/`BrandHero` fall back to emoji placeholders), so assets can
land here incrementally.

**To download the generated set:** `node scripts/fetch-brand-assets.mjs` (run
anywhere with open egress — the remote dev sandbox blocks the CDN host).

Expected files:

| File | Used by | Spec | Status |
|---|---|---|---|
| `hero.webp` | Landing hero (poster + video fallback) | 16:9 — photo→comic split transformation | ✅ generated |
| `hero.mp4` | Landing hero (animated) | 16:9, ~5s loop, H.264 | optional |
| `style-strip.webp` | Style showcase (primary) | 21:9 — same hero in all 5 labeled styles | ✅ generated |
| `style-{manga,superhero,chibi,noir,watercolor}.webp` | Style showcase tiles (fallback) | 1:1 each | optional |
| `hero-reference.webp` | Marketing / future renders | 1:1 base character photo | ✅ generated |

Mobile app icon/splash live in `apps/mobile/assets/` (ffmpeg placeholders are
committed; the fetch script overwrites the icon with the generated comic-bubble
mark).
