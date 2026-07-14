'use client';
import { useState } from 'react';
import { getApi } from '@/lib/api';

/** Optimistic Instagram-style like toggle. */
export function LikeButton({
  comicId,
  initialCount,
  initialLiked,
}: {
  comicId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await getApi().like(comicId);
      else await getApi().unlike(comicId);
    } catch {
      // Roll back on failure.
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition hover:scale-105"
    >
      <span className={liked ? 'text-brand-500' : ''}>{liked ? '❤️' : '🤍'}</span>
      {count}
    </button>
  );
}
