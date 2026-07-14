'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ComicStyle, COMIC_LIMITS, UPLOAD_LIMITS } from '@storyme/shared-types';
import { getApi } from '@/lib/api';
import { Button, Card, Spinner } from '@/components/ui';

const STYLES = Object.values(ComicStyle);

export default function CreatePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: characters, isLoading } = useQuery({
    queryKey: ['characters'],
    queryFn: () => getApi().listCharacters(),
  });

  const [characterId, setCharacterId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<string>(ComicStyle.Manga);
  const [format, setFormat] = useState<'book' | 'reel'>('book');
  const [panelCount, setPanelCount] = useState<number>(COMIC_LIMITS.DEFAULT_PANELS);

  const createComic = useMutation({
    mutationFn: () =>
      getApi().createComic({ characterId, prompt, style: style as any, format, panelCount }, crypto.randomUUID()),
    onSuccess: (comic) => {
      qc.invalidateQueries({ queryKey: ['comics'] });
      router.push(`/comic/${comic.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!characters || characters.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <CharacterCreator onCreated={() => qc.invalidateQueries({ queryKey: ['characters'] })} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create a comic</h1>
      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold">Hero</label>
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2"
          >
            <option value="">Select a character…</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Your story</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={COMIC_LIMITS.MAX_PROMPT_CHARS}
            rows={4}
            placeholder="A brave astronaut explores a candy planet and saves the gummy bears…"
            className="w-full rounded-lg border border-ink-200 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Format</label>
          <div className="flex gap-2">
            {(['book', 'reel'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                  format === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200'
                }`}
              >
                {f === 'book' ? '📖 Book' : '🎬 Reel'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Art style</label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                  style === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Pages: {panelCount}</label>
          <input
            type="range"
            min={COMIC_LIMITS.MIN_PANELS}
            max={COMIC_LIMITS.MAX_PANELS}
            value={panelCount}
            onChange={(e) => setPanelCount(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {createComic.error && <p className="text-sm text-danger">{(createComic.error as Error).message}</p>}
        <Button
          onClick={() => createComic.mutate()}
          disabled={!characterId || prompt.length < COMIC_LIMITS.MIN_PROMPT_CHARS || createComic.isPending}
          className="w-full"
        >
          {createComic.isPending ? 'Starting…' : 'Generate comic ✨'}
        </Button>
      </Card>
    </main>
  );
}

/** Minimal character creator: upload photos via presigned URLs then create the character. */
function CharacterCreator({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const api = getApi();
      const uploadIds: string[] = [];
      for (const file of files.slice(0, UPLOAD_LIMITS.MAX_PHOTOS_PER_CHARACTER)) {
        const { uploadId, uploadUrl } = await api.createUpload({
          mimeType: file.type,
          sizeBytes: file.size,
          fileName: file.name,
        });
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        await api.completeUpload(uploadId);
        uploadIds.push(uploadId);
      }
      await api.createCharacter({ name, kind: 'person', uploadIds, consent: true });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h1 className="text-xl font-bold">Create your hero</h1>
      <p className="text-sm text-ink-500">Add a name and a few clear photos of the person or pet.</p>
      <input
        placeholder="Character name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-ink-200 px-3 py-2"
      />
      <input
        type="file"
        accept={UPLOAD_LIMITS.ALLOWED_MIME_TYPES.join(',')}
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <label className="flex items-start gap-2 text-xs text-ink-500">
        <span>By continuing you confirm you have the right to use these photos and consent to processing them to create your comic.</span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={submit} disabled={busy || !name || files.length === 0} className="w-full">
        {busy ? 'Uploading…' : 'Create hero'}
      </Button>
    </Card>
  );
}
