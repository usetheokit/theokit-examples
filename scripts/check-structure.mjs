#!/usr/bin/env node
/**
 * Validate the file structure of this repository — the three things nothing else checks.
 *
 *   npm run check:structure
 *
 * `../theokit-skills` already validates each example against EXAMPLE-CONTRACT.md: required files,
 * the manifest schema, the pinned dependency, lesson syntax, driver drift. This does NOT repeat
 * any of that. It answers the questions that live BETWEEN examples, which no per-example check can
 * see:
 *
 *   readme-format     every README opens the way the corpus declares it opens
 *   index-stale       llms.txt still matches the examples on disk
 *   dangling-neighbour  a `seeAlso` / `requires` names an example that exists
 *
 * The third is the one worth explaining. EXAMPLE-CONTRACT.md says of the neighbour fields: *"an
 * agent that cannot reach the adjacent skill writes the adjacent code from memory, which is the
 * failure the corpus exists to prevent."* Nothing enforced it, so a manifest could name a
 * neighbour nobody had written — and the corpus would report a reading order it could not walk.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverExamples, renderIndex } from "./build-index.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The opening every README must have, and the reason each line is required.
 *
 * The shape is the one Claude Code's own documentation uses, and it is a shape for READERS THAT
 * ARE AGENTS: an index pointer first, so an agent that landed here by accident learns what else
 * exists before it explores; then the title; then a single blockquote line stating what the page
 * is, which is the sentence that survives being the only thing anyone reads.
 */
const README_OPENING = [
  { test: (l) => l === "> ## Documentation Index", why: "line 1 must be `> ## Documentation Index`" },
  { test: (l) => l.startsWith("> ") && l.includes("llms.txt"), why: "line 2 must point at llms.txt" },
  { test: (l) => l.startsWith("> "), why: "line 3 must continue the index blockquote" },
  { test: (l) => l === "", why: "line 4 must be blank" },
  { test: (l) => /^# \S/.test(l), why: "line 5 must be the `# ` title" },
  { test: (l) => l === "", why: "line 6 must be blank" },
  { test: (l) => /^> \S/.test(l), why: "line 7 must be the one-line `> ` summary" },
];

function checkReadme(dir) {
  const path = join(ROOT, dir, "README.md");
  if (!existsSync(path)) return [`readme-format: missing README.md`];
  const lines = readFileSync(path, "utf8").split("\n");
  const failures = [];
  README_OPENING.forEach((rule, i) => {
    if (!rule.test(lines[i] ?? "")) {
      failures.push(`readme-format: ${rule.why} (found ${JSON.stringify(lines[i] ?? "")})`);
    }
  });
  return failures;
}

function checkNeighbours(example, known) {
  const failures = [];
  for (const field of ["seeAlso", "requires"]) {
    for (const name of example.manifest[field] ?? []) {
      if (name === example.manifest.skill) {
        failures.push(`dangling-neighbour: ${field} names the example itself`);
      } else if (!known.has(name)) {
        failures.push(
          `dangling-neighbour: ${field} names "${name}", which no example in this repository declares`,
        );
      }
    }
  }
  return failures;
}

function main() {
  const examples = discoverExamples(ROOT);
  if (examples.length === 0) {
    process.stderr.write("no example found — a directory holding a skill.json is what counts\n");
    process.exit(1);
  }

  const known = new Set(examples.map((e) => e.manifest.skill));
  let failed = 0;

  const indexPath = join(ROOT, "llms.txt");
  if (!existsSync(indexPath) || readFileSync(indexPath, "utf8") !== renderIndex(examples)) {
    process.stdout.write("FAIL llms.txt\n       index-stale: run `npm run index` to regenerate it\n");
    failed += 1;
  } else {
    process.stdout.write("ok   llms.txt\n");
  }

  for (const example of examples) {
    const failures = [...checkReadme(example.dir), ...checkNeighbours(example, known)];
    if (failures.length === 0) {
      process.stdout.write(`ok   ${example.dir}\n`);
      continue;
    }
    failed += 1;
    process.stdout.write(`FAIL ${example.dir}\n`);
    for (const f of failures) process.stdout.write(`       ${f}\n`);
  }

  if (failed > 0) process.exit(1);
}

main();
