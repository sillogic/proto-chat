import { defineConfig } from './src/libs/next/config/define-config';

const isVercel = !!process.env.VERCEL_ENV;

const nextConfig = defineConfig({
  // undici v7 uses `export *` from node:buffer (CJS) which triggers a webpack warning.
  // Mark it as a server external so Next.js doesn't attempt to bundle it.
  // Keep the defaults from define-config (pdfkit, @napi-rs/canvas, pdfjs-dist) plus undici.
  serverExternalPackages: ['pdfkit', '@napi-rs/canvas', 'pdfjs-dist', 'undici'],
  // Vercel serverless optimization: exclude musl binaries and ffmpeg from all routes
  // Vercel uses Amazon Linux (glibc), not Alpine Linux (musl)
  // ffmpeg-static (~76MB) is only needed by /api/webhooks/video/* route
  // This saves ~120MB (29MB canvas-musl + 16MB sharp-musl + 76MB ffmpeg)
  outputFileTracingExcludes: isVercel
    ? {
        '*': [
          'node_modules/.pnpm/@napi-rs+canvas-*-musl*',
          'node_modules/.pnpm/@img+sharp-libvips-*musl*',
          'node_modules/ffmpeg-static/**',
          'node_modules/.pnpm/ffmpeg-static*/**',
        ],
      }
    : undefined,
  // Include ffmpeg binary only for video webhook processing
  // refs: https://github.com/vercel-labs/ffmpeg-on-vercel
  outputFileTracingIncludes: isVercel
    ? {
        '/api/webhooks/video/*': ['./node_modules/ffmpeg-static/ffmpeg'],
      }
    : undefined,
  webpack: (webpackConfig, context) => {
    const { dev } = context;
    if (!dev) {
      webpackConfig.cache = false;
    }

    return webpackConfig;
  },
});

export default nextConfig;
