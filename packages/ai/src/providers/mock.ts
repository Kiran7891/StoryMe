import type {
  ComicScript,
  ImageProvider,
  ModerationProvider,
  ModerationRequest,
  PanelImageRequest,
  ScriptRequest,
  TextProvider,
  UsageRecord,
} from '../types.js';
import { solidPng } from './png.js';

// Distinct solid colors per panel index so mock frames are visually different and
// large enough to be decoded/encoded by image and video tooling (books + reels).
const PANEL_COLORS: Array<[number, number, number]> = [
  [245, 69, 31],
  [44, 199, 176],
  [124, 92, 252],
  [255, 201, 60],
  [43, 127, 255],
  [226, 58, 69],
];

const BLOCKED = ['nsfw', 'explicit', 'gore', 'nude'];

/**
 * Deterministic, offline providers used for local development and tests
 * (AI_TEXT_PROVIDER=mock / AI_IMAGE_PROVIDER=mock). They exercise the full pipeline
 * without any GPU spend or network calls. Never selected in production configs.
 */
export class MockTextProvider implements TextProvider {
  readonly name = 'mock';
  async generateScript(req: ScriptRequest): Promise<{ script: ComicScript; usage: UsageRecord }> {
    const script: ComicScript = {
      title: req.prompt.slice(0, 60) || `${req.characterName}'s Adventure`,
      panels: Array.from({ length: req.panelCount }, (_, i) => ({
        scene: `Panel ${i + 1}: ${req.characterName} in a ${req.style} scene about "${req.prompt}".`,
        dialogue: [{ speaker: req.characterName, text: `Scene ${i + 1} begins!` }],
      })),
    };
    return {
      script,
      usage: {
        provider: this.name,
        operation: 'script',
        model: 'mock-1',
        inputTokens: req.prompt.length,
        outputTokens: req.panelCount * 20,
        estimatedCostUsd: 0,
        latencyMs: 1,
      },
    };
  }
}

export class MockImageProvider implements ImageProvider {
  readonly name = 'mock';
  async generatePanel(req: PanelImageRequest) {
    const color = PANEL_COLORS[req.panelIndex % PANEL_COLORS.length]!;
    return {
      image: { data: solidPng(512, 640, color), contentType: 'image/png' },
      usage: {
        provider: this.name,
        operation: 'image' as const,
        model: 'mock-sdxl',
        imageCount: 1,
        estimatedCostUsd: 0,
        latencyMs: 1,
      } satisfies UsageRecord,
    };
  }
}

export class MockModerationProvider implements ModerationProvider {
  readonly name = 'mock';
  async moderate(req: ModerationRequest) {
    const text = (req.text ?? '').toLowerCase();
    const hit = BLOCKED.find((w) => text.includes(w));
    return {
      result: { allowed: !hit, reason: hit ? `blocked term: ${hit}` : undefined },
      usage: {
        provider: this.name,
        operation: 'moderation' as const,
        model: 'mock-mod',
        estimatedCostUsd: 0,
        latencyMs: 1,
      } satisfies UsageRecord,
    };
  }
}
