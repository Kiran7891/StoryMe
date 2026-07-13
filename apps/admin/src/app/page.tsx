'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';
import { getSupabase } from '@/lib/supabase';
import { Button, Card, Spinner } from '@/components/ui';

export default function AdminDashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <Card className="space-y-3">
          <h1 className="text-xl font-bold">Admin sign in</h1>
          <input
            className="w-full rounded-lg border border-ink-200 px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-ink-200 px-3 py-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {authError && <p className="text-sm text-danger">{authError}</p>}
          <Button
            className="w-full"
            onClick={async () => {
              const { error } = await getSupabase().auth.signInWithPassword({ email, password });
              if (error) setAuthError(error.message);
            }}
          >
            Sign in
          </Button>
        </Card>
      </main>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const qc = useQueryClient();
  const metrics = useQuery({ queryKey: ['admin', 'metrics'], queryFn: () => getApi().admin.metrics() });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => getApi().admin.listUsers({ limit: 50 }) });
  const queue = useQuery({ queryKey: ['admin', 'queue'], queryFn: () => getApi().admin.moderationQueue({ limit: 50 }) });
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (metrics.error && (metrics.error as any)?.status === 403) setForbidden(true);
  }, [metrics.error]);

  const moderate = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      getApi().admin.moderateComic(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'queue'] }),
  });

  if (forbidden) {
    return <p className="p-8 text-danger">You do not have admin access.</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">StoryMe Admin</h1>

      <section className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="Users" value={metrics.data?.users} />
        <Stat label="Comics" value={metrics.data?.comics} />
        <Stat label="Open reports" value={metrics.data?.openReports} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Moderation queue</h2>
        {queue.isLoading ? (
          <Spinner />
        ) : queue.data && queue.data.length > 0 ? (
          <div className="space-y-2">
            {queue.data.map((r) => (
              <Card key={r.id} className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium">{r.reason}</p>
                  <p className="text-ink-400">{r.comicId ? `Comic ${r.comicId}` : `Comment ${r.commentId}`}</p>
                </div>
                {r.comicId && (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => moderate.mutate({ id: r.comicId!, decision: 'approved' })}>
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => moderate.mutate({ id: r.comicId!, decision: 'rejected' })}>
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Queue is empty.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Users</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 text-ink-500">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id} className="border-b border-ink-100">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3 text-ink-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="text-3xl font-black text-brand-600">{value ?? '—'}</p>
    </Card>
  );
}
