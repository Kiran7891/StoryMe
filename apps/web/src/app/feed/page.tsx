'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getApi, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';
import { Button, Card, EmptyState, Spinner } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FeedPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['discover'],
    queryFn: () => getApi().discover({ limit: 20 }),
    enabled: isAuthenticated,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-brand-600">StoryMe</h1>
        <Link href="/create">
          <Button>+ New comic</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {error && <p className="text-danger">Failed to load the feed.</p>}
      {data && data.length === 0 && <EmptyState title="No stories yet" hint="Be the first to create one!" />}

      <div className="space-y-5">
        {data?.map((item) => {
          const cover = mediaUrl(item.coverKey);
          return (
            <Card key={item.id} className="overflow-hidden p-0">
              <Link href={`/comic/${item.id}`}>
                {cover ? (
                  <img src={cover} alt={item.title ?? 'comic'} className="h-64 w-full object-cover" />
                ) : (
                  <div className="flex h-64 items-center justify-center bg-ink-100 text-5xl">
                    {item.format === 'reel' ? '🎬' : '📖'}
                  </div>
                )}
              </Link>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{item.title ?? 'Untitled'}</p>
                  <p className="text-xs uppercase tracking-wide text-ink-400">
                    {item.style} · {item.format}
                  </p>
                </div>
                <div className="flex gap-4 text-sm text-ink-500">
                  <span>❤️ {item.likeCount}</span>
                  <span>💬 {item.commentCount}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
