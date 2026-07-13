import type { ImageProvider, PanelImageRequest, UsageRecord } from '../types.js';
import { buildPanelImagePrompt } from '../prompts.js';

interface ReplicateConfig {
  apiKey: string;
  /** Model version id for an SDXL + InstantID / IP-Adapter FaceID pipeline. */
  modelVersion?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Panel image generation via Replicate (hosted GPU, pay-per-second). Uses an
 * SDXL + InstantID/IP-Adapter pipeline for character-consistent panels. The identity
 * reference (uploaded face image URL) conditions every panel on the same person.
 */
export class ReplicateImageProvider implements ImageProvider {
  readonly name = 'replicate';
  private readonly modelVersion: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: ReplicateConfig) {
    this.modelVersion = config.modelVersion ?? 'zsxkib/instant-id:latest';
    this.baseUrl = config.baseUrl ?? 'https://api.replicate.com/v1';
    this.pollIntervalMs = config.pollIntervalMs ?? 1500;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async generatePanel(req: PanelImageRequest): Promise<{ image: { data: Uint8Array; contentType: string }; usage: UsageRecord }> {
    const started = Date.now();
    const prompt = buildPanelImagePrompt(req);
    const faceImage = (req.identityRef.referenceImageUrl as string) ?? undefined;

    const created = await this.post('/predictions', {
      version: this.modelVersion,
      input: {
        prompt,
        image: faceImage,
        negative_prompt: 'lowres, bad anatomy, extra fingers, watermark, text',
        num_inference_steps: 30,
        guidance_scale: 5,
      },
    });

    const outputUrl = await this.pollUntilDone(created.id, started);
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
    const buf = new Uint8Array(await imgRes.arrayBuffer());

    return {
      image: { data: buf, contentType: imgRes.headers.get('content-type') ?? 'image/png' },
      usage: {
        provider: this.name,
        operation: 'image',
        model: this.modelVersion,
        imageCount: 1,
        // ~$0.02 / image on hosted GPU (adjust per measured seconds * $/s).
        estimatedCostUsd: 0.02,
        latencyMs: Date.now() - started,
      },
    };
  }

  private async post(path: string, body: unknown): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Replicate error ${res.status}: ${await res.text()}`);
    return (await res.json()) as { id: string };
  }

  private async pollUntilDone(id: string, started: number): Promise<string> {
    for (;;) {
      if (Date.now() - started > this.timeoutMs) throw new Error('Replicate prediction timed out');
      const res = await fetch(`${this.baseUrl}/predictions/${id}`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      const pred = (await res.json()) as { status: string; output?: string | string[]; error?: string };
      if (pred.status === 'succeeded') {
        const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
        if (!out) throw new Error('Replicate returned no output');
        return out;
      }
      if (pred.status === 'failed' || pred.status === 'canceled') {
        throw new Error(`Replicate prediction ${pred.status}: ${pred.error ?? 'unknown'}`);
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }
}
