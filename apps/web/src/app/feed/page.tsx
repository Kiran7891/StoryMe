'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { FeedItem } from '@storyme/api-client';
import { getApi, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';
import { Button, Card, EmptyState, Spinner } from '@/components/ui';
import { LikeButton } from '@/components/like-button';

type Tab = 'foryou' | 'following' | 'reels';

const TABS: { key: Tab; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'reels', label: 'Reels' },
];

export default function FeedPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('foryou');

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['feed', tab],
    queryFn: () => {
      const api = getApi();
      if (tab === 'following') return api.feed({ limit: 20 });
      if (tab === 'reels') return api.reels({ limit: 20 });
      return api.discover({ limit: 20 });
    },
    enabled: isAuthenticated,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black text-brand-600">StoryMe</h1>
        <Link href="/create">
          <Button>+ New story</Button>
        </Link>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-ink-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {error && <p className="text-danger">Failed to load the feed.</p>}
      {data && data.length === 0 && (
        <EmptyState
          title={tab === 'following' ? 'Nothing from people you follow yet' : 'No stories yet'}
          hint={tab === 'following' ? 'Follow creators from the For You tab.' : 'Be the first to create one!'}
        />
      )}

      {tab === 'reels' ? <ReelsRail items={data ?? []} /> : <StoryCards items={data ?? []} />}
    </main>
  );
}

function StoryCards({ items }: { items: FeedItem[] }) {
  return (
    <div className="space-y-5">
      {items.map((item) => {
        const cover = mediaUrl(item.coverKey);
        return (
          <Card key={item.id} className="overflow-hidden p-0">
            <Link href={`/comic/${item.id}`}>
              {cover ? (
                <img src={cover} alt={item.title ?? 'story'} className="h-64 w-full object-cover" />
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
              <div className="flex items-center gap-4">
                <LikeButton comicId={item.id} initialCount={item.likeCount} initialLiked={item.likedByMe} />
                <Link href={`/comic/${item.id}`} className="text-sm text-ink-500 hover:text-ink-700">
                  💬 {item.commentCount}
                </Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** TikTok-style vertical rail: 9:16 videos with snap scrolling and overlay actions. */
function ReelsRail({ items }: { items: FeedItem[] }) {
  return (
    <div className="mx-auto max-w-sm snap-y snap-mandatory space-y-6 overflow-y-auto" style={{ maxHeight: '78vh' }}>
      {items.map((item) => {
        const video = mediaUrl(item.videoKey);
        const poster = mediaUrl(item.coverKey) ?? undefined;
        return (
          <div key={item.id} className="relative snap-start overflow-hidden rounded-2xl bg-ink-900">
            {video ? (
              <video
                src={video}
                poster={poster}
                className="aspect-[9/16] w-full object-cover"
                controls
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="flex aspect-[9/16] w-full items-center justify-center text-6xl">🎬</div>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/50 px-3 py-2 text-white backdrop-blur">
              <p className="mr-2 truncate text-sm font-semibold">{item.title ?? 'Untitled reel'}</p>
              <div className="flex items-center gap-3">
                <LikeButton comicId={item.id} initialCount={item.likeCount} initialLiked={item.likedByMe} />
                <Link href={`/comic/${item.id}`} className="text-sm">
                  💬 {item.commentCount}
                </Link>
              </div>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <EmptyState title="No reels yet" hint="Create one from + New story → Reel." />}
    </div>
  );
}
