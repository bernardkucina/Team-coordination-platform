/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The shared package is TypeScript source; Next compiles it like the app's own code.
  transpilePackages: ['@hub-pulse/shared'],
  // The browser only talks to this origin; /api is forwarded to the backend, so the session cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api/:path*` }];
  },
};

export default nextConfig;
