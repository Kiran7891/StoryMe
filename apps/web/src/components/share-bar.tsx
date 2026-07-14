'use client';
import { useState } from 'react';

interface ShareBarProps {
  /** Absolute public URL of the shared story. */
  url: string;
  title: string;
  /** Direct URL of the reel MP4 (enables download + upload-to-platform flows). */
  videoUrl?: string | null;
}

/**
 * Instagram-style share row. Link platforms (X, WhatsApp, Facebook, Telegram)
 * open share intents directly. Video platforms (TikTok, YouTube, Instagram)
 * have no public web share-intent for uploads, so we use the standard flow:
 * download the reel MP4, then open the platform's upload/create page.
 */
export function ShareBar({ url, title, videoUrl }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user dismissed */
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function uploadFlow(platform: 'tiktok' | 'youtube' | 'instagram') {
    const uploadUrls = {
      tiktok: 'https://www.tiktok.com/tiktokstudio/upload',
      youtube: 'https://studio.youtube.com/channel/UC/videos/upload',
      instagram: 'https://www.instagram.com/',
    } as const;
    if (videoUrl) {
      // Grab the MP4 first, then send the user to the platform's upload page.
      window.open(videoUrl, '_blank', 'noopener');
      setHint(
        `Video opened in a new tab — save it, then post it on ${platform === 'tiktok' ? 'TikTok' : platform === 'youtube' ? 'YouTube Shorts' : 'Instagram Reels'} (upload page opening).`,
      );
      setTimeout(() => window.open(uploadUrls[platform], '_blank', 'noopener'), 800);
    } else {
      window.open(uploadUrls[platform], '_blank', 'noopener');
    }
  }

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(`${title} — made with StoryMe`);

  const chip =
    'inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-ink-50';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canNativeShare && (
          <button className={chip} onClick={nativeShare}>
            📤 Share
          </button>
        )}
        <button className={chip} onClick={copyLink}>
          {copied ? '✓ Copied' : '🔗 Copy link'}
        </button>
        {videoUrl && (
          <a className={chip} href={videoUrl} target="_blank" rel="noreferrer" download>
            ⬇️ Download video
          </a>
        )}
        <button className={chip} onClick={() => uploadFlow('tiktok')}>
          🎵 TikTok
        </button>
        <button className={chip} onClick={() => uploadFlow('youtube')}>
          ▶️ YouTube
        </button>
        <button className={chip} onClick={() => uploadFlow('instagram')}>
          📸 Instagram
        </button>
        <a
          className={chip}
          href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encoded}`}
          target="_blank"
          rel="noreferrer"
        >
          𝕏
        </a>
        <a className={chip} href={`https://wa.me/?text=${encodedTitle}%20${encoded}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <a
          className={chip}
          href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
          target="_blank"
          rel="noreferrer"
        >
          Facebook
        </a>
      </div>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
