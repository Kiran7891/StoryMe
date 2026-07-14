import type {
  ComicScript,
  GeneratedImage,
  ImageProvider,
  ModerationProvider,
  ModerationRequest,
  PanelImageRequest,
  ScriptRequest,
  TextProvider,
  UsageRecord,
} from './types.js';

export interface AiServiceConfig {
  text: TextProvider;
  image: ImageProvider;
  moderation: ModerationProvider;
  /** Optional fallbacks used if the primary provider throws. */
  textFallback?: TextProvider;
  imageFallback?: ImageProvider;
  /** Called for every provider call so the app can meter/track spend. */
  onUsage?: (usage: UsageRecord) => void;
  maxRetries?: number;
  timeoutMs?: number;
}

export class ContentBlockedError extends Error {
  constructor(reason: string) {
    super(`Content blocked: ${reason}`);
    this.name = 'ContentBlockedError';
  }
}

/**
 * Provider-agnostic AI orchestration: moderation, structured story generation, and
 * character-consistent panel rendering, with retries, timeouts, fallback providers,
 * and usage metering. All AI access in the product goes through this layer — clients
 * never call providers directly.
 */
export class AiService {
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: AiServiceConfig) {
    this.maxRetries = config.maxRetries ?? 2;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async moderate(req: ModerationRequest): Promise<void> {
    const { result, usage } = await this.config.moderation.moderate(req);
    this.config.onUsage?.(usage);
    if (!result.allowed) throw new ContentBlockedError(result.reason ?? 'policy violation');
  }

  async generateScript(req: ScriptRequest): Promise<ComicScript> {
    const run = (p: TextProvider) =>
      this.withRetry(async () => {
        const { script, usage } = await this.withTimeout(p.generateScript(req));
        this.config.onUsage?.(usage);
        return script;
      });
    try {
      return await run(this.config.text);
    } catch (err) {
      if (this.config.textFallback) return run(this.config.textFallback);
      throw err;
    }
  }

  async generatePanel(req: PanelImageRequest): Promise<GeneratedImage> {
    const run = (p: ImageProvider) =>
      this.withRetry(async () => {
        const { image, usage } = await this.withTimeout(p.generatePanel(req));
        this.config.onUsage?.(usage);
        return image;
      });
    try {
      return await run(this.config.image);
    } catch (err) {
      if (this.config.imageFallback) return run(this.config.imageFallback);
      throw err;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (err instanceof ContentBlockedError) throw err; // never retry policy blocks
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
    }
    throw lastErr;
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('AI operation timed out')), this.timeoutMs),
      ),
    ]);
  }
}
