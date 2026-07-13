'use client';
import { useState } from 'react';

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
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

/** Hero media: prefers the animated reel, falls back to the hero image, then to children. */
export function BrandHero({ className = '' }: { className?: string }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (videoFailed && imageFailed) return null;
  if (videoFailed) {
    return (
      <img
        src="/brand/hero.webp"
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
      poster="/brand/hero.webp"
      onError={() => setVideoFailed(true)}
    >
      <source src="/brand/hero.mp4" type="video/mp4" />
    </video>
  );
}
