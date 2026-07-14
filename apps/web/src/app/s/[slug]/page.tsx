import { PublicStory } from './public-story';

// Static export (GitHub Pages preview) requires generateStaticParams; the page
// itself is fully client-rendered against the public API at runtime.
export const dynamicParams = false;
export function generateStaticParams(): Array<{ slug: string }> {
  return [{ slug: 'preview' }];
}

export default function PublicStoryPage({ params }: { params: { slug: string } }) {
  return <PublicStory slug={params.slug} />;
}
