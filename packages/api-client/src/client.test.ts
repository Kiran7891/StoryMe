import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './http.js';
import { StoryMeClient } from './client.js';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('StoryMeClient', () => {
  it('sends the bearer token and hits the right URL', async () => {
    const fetchImpl = mockFetch(200, { id: 'u1', email: 'a@b.co', credits: 3 });
    const client = new StoryMeClient({
      baseUrl: 'https://api.storyme.app',
      getToken: () => 'tok123',
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const me = await client.getMe();
    expect(me.credits).toBe(3);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.storyme.app/v1/me');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok123' });
  });

  it('serializes query params', async () => {
    const fetchImpl = mockFetch(200, []);
    const client = new StoryMeClient({
      baseUrl: 'https://api.storyme.app',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await client.discover({ limit: 10 });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.storyme.app/v1/discover?limit=10');
  });

  it('throws a typed ApiError on non-2xx', async () => {
    const fetchImpl = mockFetch(402, {
      error: { code: 'insufficient_credits', message: 'Not enough credits' },
      requestId: 'r1',
    });
    const client = new StoryMeClient({
      baseUrl: 'https://api.storyme.app',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.createComic({ characterId: 'c', prompt: 'xyz', style: 'noir', format: 'book', panelCount: 6 })).rejects.toMatchObject({
      status: 402,
    });
    await client
      .createComic({ characterId: 'c', prompt: 'xyz', style: 'noir', format: 'book', panelCount: 6 })
      .catch((err) => expect((err as ApiError).code).toBe('insufficient_credits'));
  });
});
