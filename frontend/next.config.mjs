import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The shared types and the backend are TypeScript source; Next compiles them like the app's own code.
  transpilePackages: ['@hub-pulse/shared', '@hub-pulse/backend'],
  experimental: {
    // Monorepo: trace server files (Prisma, Express) from the repo root, not just frontend/.
    outputFileTracingRoot: root,
  },
  webpack: (config, { isServer }) => {
    // Copies Prisma's query engine next to the server bundle; without it Prisma cannot start on Vercel in a monorepo.
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
  // The API lives in src/pages/api/[...path].ts. Only when BACKEND_URL is set (a separately running backend,
  // e.g. `npm run dev:backend`), /api is forwarded there instead.
  async rewrites() {
    if (!process.env.BACKEND_URL) return [];
    return { beforeFiles: [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL}/api/:path*` }] };
  },
};

export default nextConfig;
