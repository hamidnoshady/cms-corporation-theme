import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Resolve metadata before streaming so missing/draft pages return real HTTP 404s.
  htmlLimitedBots: /.*/,
  transpilePackages: ['@eshobe/site-runtime'],
  allowedDevOrigins: ['*.e2b.app', '127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // No X-Frame-Options: CMS/editor and Arena previews are intentionally embedded.
          // A strict nonce CSP is an operator option; Next RSC inline scripts need it wired end-to-end.
        ],
      },
    ];
  },
};
export default nextConfig;
