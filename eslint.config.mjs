import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      ".venv",
      "services/agent-kisan/.venv",
      "**/.venv/**",
      ".aws-sam/**",
    ],
  },
  ...compat.config({
    extends: ["next"],
  }),
];

export default config;
