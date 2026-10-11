import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cedar (services/command-api/authz.ts) reads its .wasm file from next to its own code, so the server
  // must load it from node_modules instead of bundling it.
  serverExternalPackages: ['@cedar-policy/cedar-wasm'],
  // Next's round "N" dev badge sits on the first tab of the app's bottom bar; errors still show their overlay.
  devIndicators: false,
};

export default nextConfig;
