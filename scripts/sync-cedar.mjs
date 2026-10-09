import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const templatePath = resolve(root, "infra/template.yaml");
const schema = readFileSync(resolve(root, "infra/policies/schema.cedar"), "utf8").trim();
const policies = readFileSync(resolve(root, "infra/policies/policies.cedar"), "utf8").trim();
const statements = policies.split(/\n\s*\n(?=permit\s*\()/);
if (statements.length !== 2) throw new Error("policies.cedar must contain the whoami policy followed by the case policy");
JSON.parse(schema);

const indent = (value, spaces) => value.split("\n").map((line) => `${" ".repeat(spaces)}${line}`).join("\n");
let rendered = readFileSync(templatePath, "utf8");
rendered = rendered.replace(/(CedarJson:)\s*'[^\n]*'/, `$1 '${schema.replaceAll("'", "''")}'`);
rendered = rendered.replace(
  /(  WhoamiPolicy:[\s\S]*?Statement: \|\n)[\s\S]*?(\n\n  CasesPolicy:)/,
  `$1${indent(statements[0], 12)}$2`,
);
rendered = rendered.replace(
  /(  CasesPolicy:[\s\S]*?Statement: \|\n)[\s\S]*?(\n\n  AuthorizerFunction:)/,
  `$1${indent(statements[1], 12)}$2`,
);

const current = readFileSync(templatePath, "utf8");
if (process.argv.includes("--check")) {
  if (rendered !== current) {
    console.error("infra/template.yaml Cedar is stale; run npm run cedar:sync");
    process.exit(1);
  }
} else {
  writeFileSync(templatePath, rendered);
}
