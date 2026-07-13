import { describe, expect, it, vi } from 'vitest';
import { comicScriptSchema } from './types.js';
import { createAiService } from './factory.js';
import { AiService, ContentBlockedError } from './service.js';
import { MockImageProvider, MockModerationProvider, MockTextProvider } from './providers/mock.js';

const req = { prompt: 'a space adventure', style: 'manga' as const, characterName: 'Alice', panelCount: 5 };

describe('AiService (mock providers)', () => {
  it('generates a schema-valid script with the requested panel count', async () => {
    const svc = createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' });
    const script = await svc.generateScript(req);
    expect(comicScriptSchema.safeParse(script).success).toBe(true);
    expect(script.panels).toHaveLength(5);
  });

  it('generates a panel image', async () => {
    const svc = createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' });
    const img = await svc.generatePanel({
      scene: 'Alice flies',
      style: 'manga',
      characterName: 'Alice',
      identityRef: {},
      panelIndex: 0,
    });
    expect(img.contentType).toBe('image/png');
    expect(img.data.byteLength).toBeGreaterThan(0);
  });

  it('reports usage for cost tracking', async () => {
    const onUsage = vi.fn();
    const svc = createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' }, onUsage);
    await svc.generateScript(req);
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ operation: 'script' }));
  });

  it('blocks disallowed content and never retries the block', async () => {
    const svc = createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' });
    await expect(svc.moderate({ kind: 'text', text: 'explicit content' })).rejects.toBeInstanceOf(
      ContentBlockedError,
    );
  });

  it('falls back to a secondary provider when the primary throws', async () => {
    const failing = {
      name: 'flaky',
      generateScript: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const svc = new AiService({
      text: failing,
      image: new MockImageProvider(),
      moderation: new MockModerationProvider(),
      textFallback: new MockTextProvider(),
      maxRetries: 0,
    });
    const script = await svc.generateScript(req);
    expect(script.panels.length).toBe(5);
    expect(failing.generateScript).toHaveBeenCalled();
  });
});
