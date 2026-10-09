import nextConfig from "eslint-config-next";

const config = [
  { ignores: [".venv", "services/agent-kisan/.venv", "**/.venv/**", ".aws-sam/**"] },
  ...nextConfig,
];

export default config;
