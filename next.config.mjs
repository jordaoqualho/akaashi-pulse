import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {

    ignoreDuringBuilds: true,
  },
};

// `next dev` gets its own build folder so `pnpm dev` never wipes the
// `.next/standalone` bundle that the background service is running from.
// `pnpm demo` uses a third folder so it can run next to `pnpm dev`.
export default function config(phase) {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;
  return process.env.AKAASHI_PULSE_DEMO === '1'
    ? { ...nextConfig, distDir: '.next-demo', devIndicators: false }
    : { ...nextConfig, distDir: '.next-dev' };
}
