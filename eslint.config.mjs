import nextConfig from "eslint-config-next";

const config = [
  { ignores: [".venv", "services/agent-kisan/.venv", "**/.venv/**"] },
  ...nextConfig,
];

export default config;
