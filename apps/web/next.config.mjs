/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace packages (they ship ESM/TS via dist).
  transpilePackages: [
    '@storyme/api-client',
    '@storyme/design-tokens',
    '@storyme/shared-types',
    '@storyme/validation',
  ],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
