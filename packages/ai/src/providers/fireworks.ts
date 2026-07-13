import { comicScriptSchema, type ComicScript, type ScriptRequest, type TextProvider, type UsageRecord } from '../types.js';
import { buildScriptPrompt } from '../prompts.js';

interface FireworksConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Text/story generation via Fireworks AI (hosted open models, e.g. Llama 3.3 70B).
 * Requests a strict JSON comic script and validates it against comicScriptSchema.
 */
export class FireworksTextProvider implements TextProvider {
  readonly name = 'fireworks';
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: FireworksConfig) {
    this.model = config.model ?? 'accounts/fireworks/models/llama-v3p3-70b-instruct';
    this.baseUrl = config.baseUrl ?? 'https://api.fireworks.ai/inference/v1';
  }

  async generateScript(req: ScriptRequest): Promise<{ script: ComicScript; usage: UsageRecord }> {
    const started = Date.now();
    const { system, user } = buildScriptPrompt(req);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      throw new Error(`Fireworks error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const content = json.choices[0]?.message.content ?? '{}';
    const script = comicScriptSchema.parse(JSON.parse(content));

    const inputTokens = json.usage?.prompt_tokens ?? 0;
    const outputTokens = json.usage?.completion_tokens ?? 0;
    return {
      script,
      usage: {
        provider: this.name,
        operation: 'script',
        model: this.model,
        inputTokens,
        outputTokens,
        // ~$0.9 / 1M tokens blended for 70B-class hosted models (adjust per pricing).
        estimatedCostUsd: ((inputTokens + outputTokens) / 1_000_000) * 0.9,
        latencyMs: Date.now() - started,
      },
    };
  }
}
