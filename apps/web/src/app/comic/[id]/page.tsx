import { ComicReader } from './reader';

// Static export (GitHub Pages preview) requires generateStaticParams on dynamic
// routes; a placeholder id keeps the route buildable while the reader itself is
// fully client-rendered at runtime.
export const dynamicParams = false;
export function generateStaticParams(): Array<{ id: string }> {
  return [{ id: 'preview' }];
}

export default function ComicReaderPage({ params }: { params: { id: string } }) {
  return <ComicReader id={params.id} />;
}
