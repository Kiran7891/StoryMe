'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const fn =
        mode === 'signin'
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });
      const { error } = await fn;
      if (error) throw error;
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    await getSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/feed` } });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <h1 className="mb-1 text-2xl font-bold">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mb-6 text-sm text-ink-500">Start making personalized comics.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>
        <div className="my-4 text-center text-xs text-ink-400">or</div>
        <Button variant="ghost" onClick={google} className="w-full border border-ink-200">
          Continue with Google
        </Button>
        <button
          className="mt-4 w-full text-center text-sm text-brand-600"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </Card>
    </main>
  );
}
