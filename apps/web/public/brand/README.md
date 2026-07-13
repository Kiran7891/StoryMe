# Brand assets

AI-generated brand art (Higgsfield). The UI degrades gracefully when a file is
missing (`BrandImage`/`BrandHero` fall back to emoji placeholders), so assets can
land here incrementally.

Expected files:

| File | Used by | Spec |
|---|---|---|
| `hero.webp` | Landing hero (poster + video fallback) | 16:9, ≥1600px wide — a photo transforming into a comic panel |
| `hero.mp4` | Landing hero (animated) | 16:9, ~5s loop, H.264 |
| `style-manga.webp` | Style showcase | 1:1 — same hero character, manga style |
| `style-superhero.webp` | Style showcase | 1:1 — same hero, superhero style |
| `style-chibi.webp` | Style showcase | 1:1 — same hero, chibi style |
| `style-noir.webp` | Style showcase | 1:1 — same hero, noir style |
| `style-watercolor.webp` | Style showcase | 1:1 — same hero, watercolor style |

Mobile app icon/splash live in `apps/mobile/assets/` (currently generated
placeholders; replace with final art at the same paths).
