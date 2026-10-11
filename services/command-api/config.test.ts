import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { describe, expect, it } from "vitest";
import { parse } from "pg-connection-string";
import { commandConfig, databaseUrlFrom, LOCAL_DATABASE_URL } from "./config";
import { envFile, envLine } from "../../scripts/amplify-env.mjs";

describe("SAANS_DATABASE_URL", () => {
  it("leaves a good URL alone, and falls back to the local stack when unset", () => {
    const url = "postgres://saans:p%23w@db.example.com:5432/saans?sslmode=require";
    expect(databaseUrlFrom(url)).toBe(url);
    expect(commandConfig({}).databaseUrl).toBe(LOCAL_DATABASE_URL);
    expect(commandConfig({ SAANS_DATABASE_URL: "  " }).databaseUrl).toBe(LOCAL_DATABASE_URL);
  });

  it("trims stray spaces and quotes from a pasted value", () => {
    expect(databaseUrlFrom('  "postgres://u:pw@h:5432/db"\n')).toBe("postgres://u:pw@h:5432/db");
    expect(databaseUrlFrom("'postgres://u:pw@h/db'")).toBe("postgres://u:pw@h/db");
  });

  it("encodes a password typed as-is, so Postgres gets the real one back", () => {
    for (const password of ["ab#cd", "a?b/c", "50%off", "p@ss", "x:y$z!"]) {
      const url = databaseUrlFrom(`postgres://saans:${password}@db.example.com:5432/saans`)!;
      const parsed = parse(url);
      expect(parsed.password).toBe(password);
      expect(parsed.host).toBe("db.example.com");
      expect(parsed.database).toBe("saans");
    }
  });

  it("names the variable, not the password, when it can't be read", () => {
    expect(() => databaseUrlFrom("postgres://u:ab")).toThrow(/SAANS_DATABASE_URL isn't a valid postgres:\/\/ URL/);
    expect(() => databaseUrlFrom("not a url secret123")).toThrow(/^(?!.*secret123)/);
  });
});

describe("scripts/amplify-env.mjs", () => {
  it("quotes each value with a quote it doesn't contain and escapes $", () => {
    expect(envLine("A", "postgres://u:ab#cd@h/db")).toBe('A="postgres://u:ab#cd@h/db"');
    expect(envLine("A", "x$y")).toBe('A="x\\$y"');
    expect(envLine("A", 'tok"en')).toBe("A=`tok\"en`");
    expect(() => envLine("A", "\"`'")).toThrow();
  });

  it("survives Next's .env loader exactly, where `env | grep` lost everything after # and $", () => {
    const values = ["postgres://u:ab#cd@h:5432/db", "postgres://u:a$b${X}c@h/db", "p\\q", "key'with'quotes", 'tok"en', "$START"];
    for (const value of values) {
      const dir = mkdtempSync(join(tmpdir(), "amplify-env-"));
      writeFileSync(join(dir, ".env"), envLine("SAANS_TEST_VALUE", value) + "\n");
      delete process.env.SAANS_TEST_VALUE;
      const { combinedEnv } = loadEnvConfig(dir, false, { info() {}, error() {} }, true);
      expect(combinedEnv.SAANS_TEST_VALUE).toBe(value);
    }
    delete process.env.SAANS_TEST_VALUE;
  });

  it("writes only the variables that are set", () => {
    expect(envFile({ SAANS_DATABASE_URL: "postgres://u:p@h/db", OTHER: "x" })).toBe('SAANS_DATABASE_URL="postgres://u:p@h/db"\n');
    expect(envFile({})).toBe("");
  });
});
