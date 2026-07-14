'use client';
import { StoryMeClient } from '@storyme/api-client';
import { publicEnv } from './env';
import { getSupabase } from './supabase';

let client: StoryMeClient | null = null;

/** Shared SDK instance that pulls the access token from the Supabase session. */
export function getApi(): StoryMeClient {
  if (!client) {
    client = new StoryMeClient({
      baseUrl: publicEnv.apiBaseUrl,
      getToken: async () => {
        const { data } = await getSupabase().auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
  }
  return client;
}

/** Build a CDN URL for a stored object key. */
export function mediaUrl(key: string | null): string | null {
  if (!key) return null;
  const base = process.env.NEXT_PUBLIC_CDN_BASE_URL ?? '';
  return base ? `${base.replace(/\/$/, '')}/${key}` : null;
}
