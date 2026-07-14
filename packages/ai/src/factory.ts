import { AiService, type AiServiceConfig } from './service.js';
import { MockImageProvider, MockModerationProvider, MockTextProvider } from './providers/mock.js';
import { FireworksTextProvider } from './providers/fireworks.js';
import { ReplicateImageProvider } from './providers/replicate.js';
import type { ImageProvider, TextProvider } from './types.js';

export interface AiFactoryEnv {
  AI_TEXT_PROVIDER: string;
  AI_IMAGE_PROVIDER: string;
  AI_TEXT_API_KEY?: string;
  AI_IMAGE_API_KEY?: string;
}

/**
 * Build an AiService from environment config. Defaults to offline mock providers so
 * local/dev/test never incurs GPU spend; production selects fireworks + replicate.
 * The mock providers double as automatic fallbacks so a provider outage degrades
 * gracefully rather than failing a generation outright.
 */
export function createAiService(
  env: AiFactoryEnv,
  onUsage?: AiServiceConfig['onUsage'],
): AiService {
  const text: TextProvider =
    env.AI_TEXT_PROVIDER === 'fireworks' && env.AI_TEXT_API_KEY
      ? new FireworksTextProvider({ apiKey: env.AI_TEXT_API_KEY })
      : new MockTextProvider();

  const image: ImageProvider =
    env.AI_IMAGE_PROVIDER === 'replicate' && env.AI_IMAGE_API_KEY
      ? new ReplicateImageProvider({ apiKey: env.AI_IMAGE_API_KEY })
      : new MockImageProvider();

  return new AiService({
    text,
    image,
    moderation: new MockModerationProvider(),
    textFallback: text.name === 'mock' ? undefined : new MockTextProvider(),
    imageFallback: image.name === 'mock' ? undefined : new MockImageProvider(),
    onUsage,
  });
}
