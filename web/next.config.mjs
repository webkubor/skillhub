import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  outputFileTracingRoot: resolve(here),
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

export default nextConfig;
