import { defineConfig } from './src/libs/next/config/define-config';

const isVercel = !!process.env.VERCEL_ENV;

const nextConfig = defineConfig({
  // undici v7 and jose v5 both use `export *` from node:buffer (CJS) which triggers a webpack
  // warning. Mark them as server externals so Next.js doesn't attempt to bundle them.
  // Keep the defaults from define-config (pdfkit, @napi-rs/canvas, pdfjs-dist) plus these.
  serverExternalPackages: [
    'pdfkit',
    '@napi-rs/canvas',
    'pdfjs-dist',
    // The following packages do `export * from 'node:buffer'` (CJS) which triggers a webpack
    // "unexpected export *" warning when bundled. Marking them as server externals prevents
    // webpack from analyzing their internals — Node.js resolves them correctly at runtime.
    'undici',
    'jose',
    'node-fetch',
    'swagger-client',
  ],
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

    // Suppress harmless warnings from packages that do `export * from 'node:buffer'` (CJS).
    // webpack can't statically analyse CJS re-exports but Node.js handles them at runtime.
    // NOTE: "unexpected export *" is Next.js's formatted header — the actual warning.message
    // contains "export * used with module" and "CommonJS module", so match those instead.
    webpackConfig.ignoreWarnings = [
      ...(webpackConfig.ignoreWarnings || []),
      (warning: Error) =>
        warning.message?.includes('export * used with module') &&
        warning.message?.includes('CommonJS module'),
    ];

    return webpackConfig;
  },
});

export default nextConfig;
