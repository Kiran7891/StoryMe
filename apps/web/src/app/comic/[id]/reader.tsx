'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi, mediaUrl } from '@/lib/api';
import { Button, Card, Spinner } from '@/components/ui';
import { ShareBar } from '@/components/share-bar';

export function ComicReader({ id }: { id: string }) {
  const qc = useQueryClient();

  const comic = useQuery({
    queryKey: ['comic', id],
    queryFn: () => getApi().getComic(id),
    // Poll while the comic is still generating.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && status !== 'complete' && status !== 'failed' && status !== 'moderated' ? 2000 : false;
    },
  });

  const share = useMutation({
    mutationFn: (isPublic: boolean) => getApi().shareComic(id, { isPublic }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comic', id] }),
  });

  if (comic.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (comic.error || !comic.data) {
    return <p className="p-8 text-danger">Could not load this story.</p>;
  }

  const c = comic.data;
  const generating = c.status === 'queued' || c.status === 'processing';
  const isReel = c.format === 'reel';
  const videoUrl = mediaUrl(c.videoKey);
  const publicUrl = c.shareSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${c.shareSlug}`
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-black">{c.title ?? 'Your story'}</h1>
      <p className="mb-6 text-sm uppercase tracking-wide text-ink-400">
        {c.style} · {c.format} · {c.status}
      </p>

      {generating && (
        <Card className="mb-6 flex items-center gap-3">
          <Spinner />
          <div>
            <p className="font-semibold">Creating your {isReel ? 'reel' : 'comic'}…</p>
            <p className="text-sm text-ink-500">This usually takes a minute or two. This page updates automatically.</p>
          </div>
        </Card>
      )}

      {c.status === 'failed' && (
        <Card className="mb-6 border-danger">
          <p className="font-semibold text-danger">Generation failed.</p>
          <p className="text-sm text-ink-500">Your credits were refunded. Please try again.</p>
        </Card>
      )}

      {/* Reel: vertical video front and center */}
      {isReel && videoUrl && (
        <div className="mx-auto mb-6 max-w-sm overflow-hidden rounded-2xl bg-ink-900">
          <video src={videoUrl} className="aspect-[9/16] w-full" controls playsInline preload="metadata" />
        </div>
      )}

      {/* Book pages (or the reel's storyboard) */}
      <div className="space-y-4">
        {c.panels.map((panel) => {
          const url = mediaUrl(panel.imageKey);
          return (
            <figure key={panel.id} className="comic-panel overflow-hidden rounded-lg">
              {url ? (
                <img src={url} alt={panel.scene ?? `panel ${panel.index}`} className="w-full" />
              ) : (
                <div className="flex h-56 items-center justify-center bg-ink-100 text-ink-400">
                  Panel {panel.index + 1}…
                </div>
              )}
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

      {c.status === 'complete' && (
        <Card className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{c.isPublic ? 'Shared to the feed' : 'Private'}</p>
            <Button onClick={() => share.mutate(!c.isPublic)} disabled={share.isPending}>
              {c.isPublic ? 'Make private' : 'Share to feed'}
            </Button>
          </div>
          {c.isPublic && publicUrl && (
            <ShareBar url={publicUrl} title={c.title ?? 'My StoryMe story'} videoUrl={isReel ? videoUrl : null} />
          )}
        </Card>
      )}

      {c.status === 'complete' && <Comments comicId={id} />}
    </main>
  );
}

function Comments({ comicId }: { comicId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const comments = useQuery({
    queryKey: ['comments', comicId],
    queryFn: () => getApi().listComments(comicId, { limit: 50 }),
  });

  const add = useMutation({
    mutationFn: () => getApi().addComment(comicId, { body }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['comments', comicId] });
    },
  });

  return (
    <Card className="mt-6">
      <h2 className="mb-3 font-semibold">Comments</h2>
      <div className="mb-4 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && body.trim() && add.mutate()}
          placeholder="Add a comment…"
          maxLength={1000}
          className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <Button onClick={() => add.mutate()} disabled={!body.trim() || add.isPending}>
          Post
        </Button>
      </div>
      {comments.isLoading && <Spinner />}
      <div className="space-y-3">
        {comments.data?.map((cm) => (
          <div key={cm.id} className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
            <p>{cm.body}</p>
            <p className="mt-0.5 text-xs text-ink-400">{new Date(cm.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {comments.data?.length === 0 && <p className="text-sm text-ink-400">Be the first to comment.</p>}
      </div>
    </Card>
  );
}
