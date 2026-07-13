import Link from 'next/link';
import { ComicStyle } from '@storyme/shared-types';

// Marketing landing page — statically rendered for SEO/performance.
const STYLES: { key: string; label: string; emoji: string }[] = [
  { key: ComicStyle.Manga, label: 'Manga', emoji: '🗾' },
  { key: ComicStyle.Superhero, label: 'Superhero', emoji: '🦸' },
  { key: ComicStyle.Chibi, label: 'Chibi', emoji: '🐣' },
  { key: ComicStyle.Noir, label: 'Noir', emoji: '🕵️' },
  { key: ComicStyle.Watercolor, label: 'Watercolor', emoji: '🎨' },
];

export default function LandingPage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-2xl font-black tracking-tight text-brand-600">StoryMe</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/pricing" className="text-ink-600 hover:text-ink-900">
            Pricing
          </Link>
          <Link href="/login" className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-4xl font-black leading-tight text-ink-900 sm:text-6xl">
          Turn your photos into <span className="text-brand-500">personalized comics</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-600">
          Upload a few photos, describe a story in your own words, pick an art style — and get a
          complete, shareable comic starring you, your kid, a friend, or your pet. In minutes. No
          drawing skills needed.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-brand-500 px-6 py-3 text-lg font-semibold text-white hover:bg-brand-600"
          >
            Create your comic
          </Link>
          <Link href="/discover" className="rounded-lg px-6 py-3 text-lg font-semibold text-ink-700 hover:bg-ink-100">
            Explore the feed →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="mb-6 text-center text-2xl font-bold">Pick a style you love</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {STYLES.map((s) => (
            <div key={s.key} className="comic-panel rounded-lg p-6 text-center">
              <div className="text-4xl">{s.emoji}</div>
              <div className="mt-2 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { t: '1. Upload photos', d: 'Add a few photos of your hero — a person, child, friend, or pet.' },
            { t: '2. Describe the story', d: 'Any genre: adventure, fantasy, bedtime tale, birthday surprise.' },
            { t: '3. Share the comic', d: 'Get a book or a reel with speech bubbles, a cover, and a title.' },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-ink-200 bg-white p-6">
              <h3 className="font-bold text-brand-600">{c.t}</h3>
              <p className="mt-2 text-sm text-ink-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-200 py-8 text-center text-sm text-ink-500">
        © {new Date().getFullYear()} StoryMe. All rights reserved.
      </footer>
    </main>
  );
}
