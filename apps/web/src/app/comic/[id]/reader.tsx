'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi, mediaUrl } from '@/lib/api';
import { Button, Card, Spinner } from '@/components/ui';

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
    return <p className="p-8 text-danger">Could not load this comic.</p>;
  }

  const c = comic.data;
  const generating = c.status === 'queued' || c.status === 'processing';

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-black">{c.title ?? 'Your comic'}</h1>
      <p className="mb-6 text-sm uppercase tracking-wide text-ink-400">
        {c.style} · {c.format} · {c.status}
      </p>

      {generating && (
        <Card className="mb-6 flex items-center gap-3">
          <Spinner />
          <div>
            <p className="font-semibold">Creating your comic…</p>
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
        <div className="mt-6 flex gap-3">
          <Button onClick={() => share.mutate(!c.isPublic)} disabled={share.isPending}>
            {c.isPublic ? 'Make private' : 'Share to feed'}
          </Button>
          {c.shareSlug && c.isPublic && (
            <a
              className="rounded-lg border border-ink-200 px-4 py-2 font-semibold"
              href={`/s/${c.shareSlug}`}
              target="_blank"
              rel="noreferrer"
            >
              View public link ↗
            </a>
          )}
        </div>
      )}
    </main>
  );
}
