'use client';
import { useState } from 'react';

// Plain <img>/<video> tags don't get Next's basePath applied — prefix manually
// so static exports served from a sub-path (GitHub Pages preview) resolve assets.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const asset = (path: string) => `${BASE}${path}`;

/**
 * Renders a brand asset from /public/brand with a graceful fallback when the
 * asset hasn't been generated yet (pre-launch, the AI-generated art set may not
 * be present). Falls back to the given emoji/node instead of a broken image.
 */
export function BrandImage({
  src,
  alt,
  className = '',
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={asset(src)} alt={alt} className={className} onError={() => setFailed(true)} />;
}

/** Hero media: prefers the animated reel, falls back to the hero image, then to children. */
export function BrandHero({ className = '' }: { className?: string }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (videoFailed && imageFailed) return null;
  if (videoFailed) {
    return (
      <img
        src={asset('/brand/hero.webp')}
        alt="A photo transforming into a comic panel"
        className={className}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <video
      className={className}
      autoPlay
      muted
      loop
      playsInline
      poster={asset('/brand/hero.webp')}
      onError={() => setVideoFailed(true)}
    >
      <source src={asset('/brand/hero.mp4')} type="video/mp4" />
    </video>
  );
}
