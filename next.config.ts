import type { NextConfig } from "next";

// S1: security headers. Clickjacking + protocol-downgrade protection matter for a
// finance app you stay signed into. The CSP is deliberately app-aware:
//  - 'unsafe-inline' for script/style: Next's hydration and the no-flash theme
//    script in layout.tsx are inline; a nonce-based CSP is the stricter future
//    step, but this is safe here (React escapes output; no user-authored HTML).
//  - *.supabase.co in connect-src/img-src: browser auth + private-bucket signed
//    URLs (the inbox document thumbnails) come from Supabase.
// Gemini runs only in server actions, so it needs no browser connect-src entry.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
