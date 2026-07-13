import { StoryMeClient } from '@storyme/api-client';
import { config, supabase } from './supabase';

/** Shared typed SDK using the SecureStore-backed Supabase session token. */
export const api = new StoryMeClient({
  baseUrl: config.apiBaseUrl,
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});

export function mediaUrl(key: string | null): string | null {
  if (!key) return null;
  return config.cdnBaseUrl ? `${config.cdnBaseUrl.replace(/\/$/, '')}/${key}` : null;
}
