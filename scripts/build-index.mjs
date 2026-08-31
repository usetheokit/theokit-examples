#!/usr/bin/env node
/**
 * Generate `llms.txt` — the agent-facing index of every example in this repository.
 *
 *   npm run index          rewrite llms.txt from the examples on disk
 *   npm run index:check    exit 1 when llms.txt has drifted from them
 *
 * The index is GENERATED, never written by hand. A hand-written index is a summary that can
 * disagree with the thing it summarises, and a reader stops at the summary — so a stale one
 * reports absence where an example exists. Nothing forces the index and the directories to move
 * together, which is why `--check` exists and why the structure check runs it.
 *
 * The format is llms.txt: an H1, a blockquote summary, then one bullet per document. An agent
 * fetches this file first to learn what the corpus holds before opening anything.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INDEX = join(ROOT, "llms.txt");

/** The closed layer vocabulary, in reading order. Mirrors EXAMPLE-CONTRACT.md § category. */
const LAYERS = ["sdk", "framework", "ui", "tui", "di", "plugins", "gateways"];

const LAYER_TITLES = {
  sdk: "SDK",
  framework: "Framework",
  ui: "UI",
  tui: "TUI",
  di: "Dependency injection",
  plugins: "Plugins",
  gateways: "Gateways",
};

/**
 * Every example, discovered the way the contract defines one: a directory holding a `skill.json`.
 * Discovery is deliberately identical to the checker's, so the index cannot list a directory the
 * checker ignores, or miss one it validates.
 */
export function discoverExamples(root = ROOT) {
  const found = [];
  walk(root);
  return found.sort((a, b) => a.dir.localeCompare(b.dir));

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === "skill.json")) {
      found.push(read(dir));
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(join(dir, entry.name));
    }
  }

  function read(dir) {
    const manifest = JSON.parse(readFileSync(join(dir, "skill.json"), "utf8"));
    const rel = relative(root, dir).split("\\").join("/");
    return { dir: rel, layer: rel.split("/")[0], manifest };
  }
}

/** The index as it SHOULD read for the examples currently on disk. */
export function renderIndex(examples) {
  const lines = [
    "# theokit examples",
    "",
    "> Runnable examples for the theokit ecosystem — one directory per documented capability, each",
    "> installing theokit from npm at a pinned version, exactly as a stranger would.",
    "",
    "Every example is a directory holding a `skill.json`. Its `README.md` opens with a one-line",
    "summary of what the example proves; its `src/` holds the lessons a generated skill copies",
    "verbatim. Read the README first, then the file the lesson names.",
    "",
  ];

  for (const layer of LAYERS) {
    const inLayer = examples.filter((e) => e.layer === layer);
    if (inLayer.length === 0) continue;
    lines.push(`## ${LAYER_TITLES[layer]}`, "");
    for (const ex of inLayer) {
      lines.push(`- [${ex.dir}](${ex.dir}/README.md): ${ex.manifest.concept}`);
    }
    lines.push("");
  }

  lines.push(
    "## Contract",
    "",
    "- [EXAMPLE-CONTRACT.md](EXAMPLE-CONTRACT.md): the shape every example above must have, and the",
    "  name of the checker rule that fires when one does not",
    "",
  );

  return lines.join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  const examples = discoverExamples();
  if (examples.length === 0) {
    process.stderr.write("no example found — a directory holding a skill.json is what counts\n");
    process.exit(1);
  }

  const expected = renderIndex(examples);

  if (!check) {
    writeFileSync(INDEX, expected);
    process.stdout.write(`wrote llms.txt — ${examples.length} example(s)\n`);
    return;
  }

  if (!existsSync(INDEX)) {
    process.stderr.write("llms.txt is absent. An absent index is a stale one: run `npm run index`.\n");
    process.exit(1);
  }
  if (readFileSync(INDEX, "utf8") !== expected) {
    process.stderr.write(
      "llms.txt has drifted from the examples on disk. Run `npm run index` to regenerate it.\n",
    );
    process.exit(1);
  }
  process.stdout.write(`ok   llms.txt — ${examples.length} example(s)\n`);
}

// Run only when invoked directly. The first draft guarded on `argv[1]` being a file, which is
// true when ANOTHER module imports this one — so importing it wrote llms.txt as a side effect.
// A module that writes a file on import is a module nobody can safely reuse.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
