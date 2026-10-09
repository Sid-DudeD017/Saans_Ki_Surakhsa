import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cedar (services/command-api/authz.ts) reads its .wasm file from next to its own code, so the server
  // must load it from node_modules instead of bundling it.
  serverExternalPackages: ['@cedar-policy/cedar-wasm'],
};

export default nextConfig;
