/** @type {import('next').NextConfig} */

// Static-export mode (NEXT_OUTPUT=export) powers the GitHub Pages preview:
// the site is served from a sub-path (/<repo>) with no image optimizer.
const isExport = process.env.NEXT_OUTPUT === 'export';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig = {
  reactStrictMode: true,
  ...(isExport ? { output: 'export', basePath, images: { unoptimized: true } } : {}),
  // Compile the shared workspace packages (they ship ESM/TS via dist).
  transpilePackages: [
    '@storyme/api-client',
    '@storyme/design-tokens',
    '@storyme/shared-types',
    '@storyme/validation',
  ],
  ...(isExport
    ? {}
    : {
        images: {
          remotePatterns: [{ protocol: 'https', hostname: '**' }],
        },
      }),
};

export default nextConfig;
