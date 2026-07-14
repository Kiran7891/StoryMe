'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getApi, mediaUrl } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { ShareBar } from '@/components/share-bar';

/** Public, no-auth view of a shared story — the page a share link lands on. */
export function PublicStory({ slug }: { slug: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public', slug],
    queryFn: () => getApi().getPublicComic(slug),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-4xl">🙈</p>
        <h1 className="mt-3 text-xl font-bold">This story isn&apos;t available</h1>
        <p className="mt-1 text-sm text-ink-500">It may have been made private or removed.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-brand-500 px-5 py-2.5 font-semibold text-white">
          Make your own story
        </Link>
      </main>
    );
  }

  const isReel = data.format === 'reel';
  const videoUrl = mediaUrl(data.videoKey);
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-black text-brand-600">
          StoryMe
        </Link>
        <Link href="/login" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
          Make your own
        </Link>
      </header>

      <h1 className="text-3xl font-black">{data.title ?? 'A StoryMe story'}</h1>
      <p className="mb-6 text-sm uppercase tracking-wide text-ink-400">
        {data.style} · {data.format}
      </p>

      {isReel && videoUrl && (
        <div className="mx-auto mb-6 max-w-sm overflow-hidden rounded-2xl bg-ink-900">
          <video src={videoUrl} className="aspect-[9/16] w-full" controls playsInline preload="metadata" />
        </div>
      )}

      <div className="space-y-4">
        {data.panels.map((panel) => {
          const url = mediaUrl(panel.imageKey);
          return (
            <figure key={panel.index} className="comic-panel overflow-hidden rounded-lg">
              {url && <img src={url} alt={`panel ${panel.index + 1}`} className="w-full" />}
              {panel.dialogue?.length > 0 && (
                <figcaption className="space-y-1 bg-white p-3 text-sm">
                  {panel.dialogue.map((d, i) => (
                    <p key={i}>
                      <span className="font-semibold">{d.speaker ?? 'Narrator'}:</span> {d.text}
                    </p>
                  ))}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-ink-200 bg-white p-4">
        <p className="mb-3 font-semibold">Share this story</p>
        <ShareBar url={pageUrl} title={data.title ?? 'A StoryMe story'} videoUrl={isReel ? videoUrl : null} />
      </div>
    </main>
  );
}
