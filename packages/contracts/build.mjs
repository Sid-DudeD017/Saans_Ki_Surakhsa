// Builds packages/contracts/openapi.yaml, the one spec, from each owner's proposal:
//
//   proposals/p1-kisan.openapi.json     P1, generated from services/agent-kisan
//   proposals/p2-shala.openapi.*        P2, when it exists
//   proposals/p3-aqi.openapi.json       P3
//   proposals/p4-command.openapi.yaml   P4
//
// Run `npm run contracts` after changing a proposal: it rewrites openapi.yaml and types.ts, and CI
// fails if either is out of date. Never edit openapi.yaml by hand.
//
// Rules: a path and method belongs to one proposal (two claiming it is an error), operation ids are
// unique, and components with the same name must mean the same: equal once their documentation
// (description, title, examples) is set aside, in which case the first copy is kept. If they differ,
// the later proposal's copy is renamed with its owner's prefix (P2's Location differs from P1's, so it
// becomes ShalaLocation) and its $refs follow. A proposal can point at another's component with "./p1-kisan.openapi.json#/...".

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROPOSALS = join(HERE, "proposals");
const OUT = join(HERE, "openapi.yaml");

const OWNERS = {
  "p1-kisan": { owner: "P1", tag: "Kisan", prefix: "Kisan", about: "Kisan Saathi: farms, plans, CHCs, the farmer agent" },
  "p2-shala": { owner: "P2", tag: "Shala", prefix: "Shala", about: "Saans Shala: schools" },
  "p3-aqi": { owner: "P3", tag: "Air", prefix: "Aqi", about: "Ghar ki Hawa and air data: AQI, forecast, fires, indoor, clean routes" },
  "p4-command": { owner: "P4", tag: "Command", prefix: "Command", about: "Saans Command: uploads, complaints, cases, public board" },
};
const KINDS = ["schemas", "responses", "parameters", "requestBodies", "headers", "examples", "securitySchemes"];
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const DOCS = new Set(["description", "title", "summary", "example", "examples", "externalDocs"]);
const NAME_MAPS = new Set(["properties", "patternProperties", "$defs", "definitions"]); // keys there are names, not keywords

// What a component means, without its documentation: two proposals may describe the same codes differently.
function meaning(node, keysAreNames = false) {
  if (Array.isArray(node)) return node.map((x) => meaning(x));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (!keysAreNames && DOCS.has(key)) continue;
    out[key] = meaning(value, !keysAreNames && NAME_MAPS.has(key));
  }
  return out;
}

function load() {
  const files = readdirSync(PROPOSALS)
    .filter((f) => /\.openapi\.(json|ya?ml)$/.test(f))
    .sort();
  return files.map((file) => {
    const stem = file.replace(/\.openapi\.(json|ya?ml)$/, "");
    const owner = OWNERS[stem];
    if (!owner) throw new Error(`${file}: unknown proposal; add it to OWNERS in build.mjs`);
    const text = readFileSync(join(PROPOSALS, file), "utf8");
    return { file, stem, ...owner, spec: file.endsWith(".json") ? JSON.parse(text) : YAML.parse(text) };
  });
}

// Decide every component's final name: shared when it means the same, prefixed when it differs.
function nameComponents(proposals) {
  const taken = {}; // kind -> name -> { value, from }
  for (const p of proposals) {
    p.renames = {};
    for (const kind of KINDS) {
      p.renames[kind] = {};
      for (const [name, value] of Object.entries(p.spec.components?.[kind] ?? {})) {
        taken[kind] ??= {};
        const seen = taken[kind][name];
        let final = name;
        if (seen && !isDeepStrictEqual(meaning(seen.value), meaning(value))) {
          final = `${p.prefix}${name}`;
          if (taken[kind][final]) throw new Error(`${p.file}: can't rename ${kind}/${name}; ${final} is taken`);
        }
        p.renames[kind][name] = final;
        if (!taken[kind][final]) taken[kind][final] = { value, from: p.file };
      }
    }
  }
  return taken;
}

function rewriteRefs(node, p, byFile) {
  if (Array.isArray(node)) return node.map((x) => rewriteRefs(x, p, byFile));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string") {
      const m = value.match(/^(?:\.\/([\w.-]+))?#\/components\/(\w+)\/(.+)$/);
      if (!m) throw new Error(`${p.file}: can't merge $ref ${value}`);
      const [, otherFile, kind, name] = m;
      const owner = otherFile ? byFile[otherFile] : p;
      if (!owner) throw new Error(`${p.file}: $ref to unknown file ${otherFile}`);
      const final = owner.renames[kind]?.[name];
      if (!final) throw new Error(`${p.file}: $ref ${value} points at nothing`);
      out[key] = `#/components/${kind}/${final}`;
    } else {
      out[key] = rewriteRefs(value, p, byFile);
    }
  }
  return out;
}

export function build() {
  const proposals = load();
  nameComponents(proposals);
  const byFile = Object.fromEntries(proposals.map((p) => [p.file, p]));

  const paths = {};
  const operationIds = new Map();
  const components = {};
  for (const p of proposals) {
    const spec = rewriteRefs(p.spec, p, byFile);
    for (const kind of KINDS) {
      for (const [name, value] of Object.entries(spec.components?.[kind] ?? {})) {
        components[kind] ??= {};
        components[kind][p.renames[kind][name]] ??= value;
      }
    }
    for (const [path, item] of Object.entries(spec.paths ?? {})) {
      paths[path] ??= {};
      for (const [method, op] of Object.entries(item)) {
        if (!METHODS.includes(method)) {
          paths[path][method] = op;
          continue;
        }
        if (paths[path][method]) throw new Error(`${method.toUpperCase()} ${path} is in two proposals`);
        if (operationIds.has(op.operationId)) {
          throw new Error(`operationId ${op.operationId} is in ${operationIds.get(op.operationId)} and ${p.file}`);
        }
        operationIds.set(op.operationId, p.file);
        const security = op.security ?? spec.security; // a proposal's top-level security applies to its own paths
        paths[path][method] = {
          ...op,
          tags: op.tags?.length ? op.tags : [p.tag],
          ...(security ? { security } : {}),
          "x-owner": p.owner,
        };
      }
      if (spec.servers) paths[path].servers ??= spec.servers;
    }
  }

  const sortedPaths = Object.fromEntries(Object.keys(paths).sort().map((k) => [k, paths[k]]));
  for (const kind of Object.keys(components)) {
    components[kind] = Object.fromEntries(Object.keys(components[kind]).sort().map((k) => [k, components[kind][k]]));
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Saans API",
      version: "1.0.0",
      description:
        "The one contract for Saans, joined from each owner's proposal in packages/contracts/proposals by " +
        "build.mjs. Conventions: packages/contracts/CONVENTIONS.md.",
      license: { name: "MIT", identifier: "MIT" },
    },
    servers: [{ url: "http://127.0.0.1:4010", description: "Prism mock of this spec (npm run mock)" }],
    tags: proposals.map((p) => ({ name: p.tag, description: `${p.owner} · ${p.about}` })),
    paths: sortedPaths,
    components,
  };
}

export function render() {
  const header =
    "# GENERATED by packages/contracts/build.mjs from packages/contracts/proposals. Don't edit:\n" +
    "# change your proposal and run `npm run contracts`.\n";
  return header + YAML.stringify(build(), { lineWidth: 0, aliasDuplicateObjects: false });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, render());
  console.log(`wrote ${OUT}`);
}
