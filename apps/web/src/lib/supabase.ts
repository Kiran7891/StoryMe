'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from './env';

let client: SupabaseClient | null = null;

/** Lazily create the browser Supabase client (persists the session in storage). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
