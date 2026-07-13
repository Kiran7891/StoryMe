import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'StoryMe Admin',
  robots: { index: false, follow: false },
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
