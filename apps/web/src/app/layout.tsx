import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'StoryMe — Turn your photos into personalized comic stories',
    template: '%s · StoryMe',
  },
  description:
    'Upload a few photos, describe a story, pick an art style, and get a shareable comic book starring someone you know — in minutes. No drawing skills required.',
  openGraph: {
    title: 'StoryMe',
    description: 'Turn your photos into personalized comic stories.',
    type: 'website',
  },
  metadataBase: new URL('https://storyme.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
