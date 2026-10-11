// Amplify's build gives server routes only what's written to .env.production. A plain `env | grep >>` breaks
// values Next's .env loader reads specially: everything after a `#` is a comment and `$NAME` expands, so a
// database password like `ab#cd` reached the server as `postgres://u:ab` ("Invalid URL" on /v1/tickets).
// This writes each value quoted with a quote character it doesn't contain, with `$` escaped, which Next reads
// back exactly.
//   node scripts/amplify-env.mjs            appends the names below that are set to .env.production
import { appendFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PASSED = [
  "NASA_FIRMS_MAP_KEY",
  "OPENAQ_API_KEY",
  "CPCB_API_KEY",
  "WAQI_TOKEN",
  "SAANS_DATABASE_URL",
  "KISAN_AGENT_URL",
];

/**
 * One .env line that Next's loader reads back as exactly `value`.
 * @param {string} name
 * @param {string} value
 */
export function envLine(name, value) {
  const quote = ['"', "`", "'"].find((q) => !value.includes(q));
  if (!quote) throw new Error(`${name} contains ", \` and ' together, which a .env file can't hold`);
  return `${name}=${quote}${value.replace(/\$/g, "\\$")}${quote}`;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {string[]} [names]
 */
export function envFile(env = process.env, names = PASSED) {
  return names
    .filter((name) => env[name])
    .map((name) => envLine(name, /** @type {string} */ (env[name])) + "\n")
    .join("");
}

// Run as a script (not imported by the tests). realpath: /tmp and the like can be symlinks.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const text = envFile();
  appendFileSync(".env.production", text);
  console.log(`amplify-env: wrote ${PASSED.filter((n) => process.env[n]).join(", ") || "nothing"} to .env.production`);
}
