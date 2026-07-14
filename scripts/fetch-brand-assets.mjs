#!/usr/bin/env node
/**
 * Downloads the AI-generated brand assets (Higgsfield) into place:
 *   apps/web/public/brand/  and  apps/mobile/assets/
 *
 * Run from the repo root on any machine with open egress (the remote dev
 * sandbox blocks the CDN host):  node scripts/fetch-brand-assets.mjs
 *
 * Idempotent — re-downloads and overwrites. The web UI falls back gracefully
 * when a file is missing, so partial runs are safe.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Generated 2026-07-13 via Higgsfield (soul_2 base + nano_banana_pro renders).
// Keys are repo-relative destination paths.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3Eyb8w1LiUH3epxobgQ4LwEIS96';
const ASSETS = {
  // Landing hero: photo→comic split transformation (16:9)
  'apps/web/public/brand/hero.webp': `${CDN}/hf_20260713_225817_a1233348-2fc9-46aa-b760-3fa442ecf795_min.webp`,
  // Style showcase strip — the SAME hero character in all five labeled styles (21:9)
  'apps/web/public/brand/style-strip.webp': `${CDN}/hf_20260713_230104_2470567a-fce9-471f-bfc4-6f74c60c647b_min.webp`,
  // App icon (1024×1024 PNG, comic speech-bubble mark on brand orange)
  'apps/mobile/assets/icon.png': `${CDN}/hf_20260713_225636_d30d4d9b-1205-4fe0-b502-37b20bd53b5b.png`,
  'apps/mobile/assets/adaptive-icon.png': `${CDN}/hf_20260713_225636_d30d4d9b-1205-4fe0-b502-37b20bd53b5b.png`,
  // Base hero reference photo (kept for future style renders / marketing)
  'apps/web/public/brand/hero-reference.webp': `${CDN}/hf_20260713_225623_5f906602-0d21-49e9-9729-261fe3dde69d_min.webp`,
  // Optional per-style tiles (not yet generated — strip covers the showcase):
  // 'apps/web/public/brand/style-manga.webp' … style-{superhero,chibi,noir,watercolor}.webp
};

let failures = 0;
for (const [dest, url] of Object.entries(ASSETS)) {
  if (!url.startsWith('http')) {
    console.warn(`~ skip ${dest} (no URL recorded)`);
    continue;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = join(root, dest);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buf);
    console.log(`✓ ${dest} (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    failures++;
    console.error(`✗ ${dest}: ${err.message}`);
  }
}
process.exit(failures > 0 ? 1 : 0);
