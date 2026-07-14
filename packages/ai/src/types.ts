import { z } from 'zod';
import type { ComicStyle } from '@storyme/shared-types';

/** Structured comic script the text model must return. Validated before use. */
export const panelScriptSchema = z.object({
  scene: z.string().min(1),
  dialogue: z
    .array(z.object({ speaker: z.string().default('Narrator'), text: z.string().min(1) }))
    .default([]),
});

export const comicScriptSchema = z.object({
  title: z.string().min(1).max(120),
  panels: z.array(panelScriptSchema).min(1).max(12),
});
export type ComicScript = z.infer<typeof comicScriptSchema>;
export type PanelScript = z.infer<typeof panelScriptSchema>;

export interface ScriptRequest {
  prompt: string;
  style: ComicStyle;
  characterName: string;
  panelCount: number;
}

export interface PanelImageRequest {
  scene: string;
  style: ComicStyle;
  characterName: string;
  /** Identity reference (e.g. InstantID face embedding key / reference image URL). */
  identityRef: Record<string, unknown>;
  panelIndex: number;
}

export interface GeneratedImage {
  /** Raw image bytes the caller uploads to storage. */
  data: Uint8Array;
  contentType: string;
}

export interface ModerationRequest {
  kind: 'text' | 'image';
  text?: string;
  imageUrl?: string;
}

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

/** Usage accounting emitted by every provider call for cost tracking. */
export interface UsageRecord {
  provider: string;
  operation: 'script' | 'image' | 'moderation';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  estimatedCostUsd: number;
  latencyMs: number;
}

export interface TextProvider {
  readonly name: string;
  generateScript(req: ScriptRequest): Promise<{ script: ComicScript; usage: UsageRecord }>;
}

export interface ImageProvider {
  readonly name: string;
  generatePanel(req: PanelImageRequest): Promise<{ image: GeneratedImage; usage: UsageRecord }>;
}

export interface ModerationProvider {
  readonly name: string;
  moderate(req: ModerationRequest): Promise<{ result: ModerationResult; usage: UsageRecord }>;
}
