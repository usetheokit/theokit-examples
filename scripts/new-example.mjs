#!/usr/bin/env node
/**
 * Scaffold an example, or re-sync the driver runtime into the ones that exist.
 *
 *   npm run new -- sdk/sessions              scaffold a new example
 *   npm run sync                             copy _driver/cli-runtime.ts into every example
 *
 * The runtime is copied rather than imported (see `_driver/cli-runtime.ts` for why), so `sync` is
 * how a fix to the runner reaches every example. `driver-drift` in the contract check is what
 * tells you the sync has not been run.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DRIVER = join(ROOT, "_driver");

/** Every canonical file, so adding one to `_driver/` is all it takes to ship it everywhere. */
function canonicalFiles() {
  if (!existsSync(DRIVER)) die(`no canonical driver directory at ${DRIVER}`);
  return readdirSync(DRIVER).filter((name) => name.endsWith(".ts")).sort();
}

/**
 * What one example needs. A `framework` example is an app with no CLI, so the command runner would
 * be dead weight in it; the fake provider it still needs, because every example proves its lessons.
 * Mirrors `REQUIRED_RUNTIME` in the contract checker.
 */
function neededBy(example) {
  const category = basename(dirname(example));
  const all = canonicalFiles();
  return category === "framework" ? all.filter((name) => name === "fake-provider.ts") : all;
}

/**
 * The layers, from EXAMPLE-CONTRACT.md. `framework` is excluded from scaffolding: an app has no
 * `src/` and its shape comes from `theokit`, not from a template here.
 */
const CATEGORIES = ["sdk", "ui", "tui", "di", "plugins", "gateways"];

function die(message) {
  console.error(message);
  process.exit(1);
}

/** Every directory holding a `skill.json`, which is the contract's own discovery rule. */
function findExamples(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".") || entry === "_driver") continue;
    const path = join(dir, entry);
    if (!statSync(path).isDirectory()) continue;
    if (existsSync(join(path, "skill.json"))) found.push(path);
    else findExamples(path, found);
  }
  return found;
}

function sync() {
  canonicalFiles(); // fail fast when `_driver/` is missing
  const examples = findExamples(ROOT);
  if (examples.length === 0) die("no examples found — nothing to sync");

  let copied = 0;
  for (const example of examples) {
    mkdirSync(join(example, "runtime"), { recursive: true });
    for (const name of neededBy(example)) {
      const target = join(example, "runtime", name);
      const before = existsSync(target) ? readFileSync(target, "utf8") : null;
      copyFileSync(join(DRIVER, name), target);
      const changed = before !== readFileSync(target, "utf8");
      if (changed) copied += 1;
      console.log(`${changed ? "updated" : "ok     "} ${target.slice(ROOT.length + 1)}`);
    }
  }
  console.log(`\n${examples.length} example(s), ${copied} updated`);
}

function scaffold(target) {
  const [category, slug] = target.split("/");
  if (slug === undefined || slug.length === 0) die(`expected <category>/<slug>, got "${target}"`);
  if (!CATEGORIES.includes(category)) {
    die(`"${category}" is not one of: ${CATEGORIES.join(", ")}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) die(`"${slug}" must be kebab-case`);

  const dir = join(ROOT, category, slug);
  if (existsSync(dir)) die(`${target} already exists`);
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "runtime"), { recursive: true });
  mkdirSync(join(dir, "tests"), { recursive: true });

  const files = {
    "skill.json": JSON.stringify({
      skill: `theokit-${category}-${slug}`,
      teaches: ["@theokit/sdk"],
      concept: `TODO: what this example teaches, in one sentence`,
      triggers: [slug],
      lessons: [
        { id: "minimal", explains: "TODO: the smallest thing that works" },
        { id: `core-${slug}`, explains: "TODO: the central gesture of this domain" },
        { id: "pitfall-todo", explains: "TODO: a mistake, and the symptom it produces" },
      ],
      notCovered: ["TODO: what this example deliberately does not teach"],
      credentials: ["a provider credential for THEOKIT_MODEL"],
      evidence: [
        { command: "npm start", claims: "Prints usage and exits 0 with no credential set." },
      ],
    }, null, 2) + "\n",

    "package.json": JSON.stringify({
      name: `theokit-example-${category}-${slug}`,
      private: true,
      type: "module",
      description: `TODO: one line about ${slug}.`,
      scripts: {
        start: "tsx src/cli.ts",
        build: "tsc",
        typecheck: "tsc --noEmit",
        test: "node --import tsx --test --test-concurrency=1 tests/*.test.ts",
      },
      dependencies: { "@theokit/sdk": "TODO-pin-an-exact-version" },
      devDependencies: { "@types/node": "^22.0.0", tsx: "^4.19.0", typescript: "^5.6.0" },
      engines: { node: ">=20" },
    }, null, 2) + "\n",

    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noUncheckedIndexedAccess: true,
        outDir: "dist",
        rootDir: ".",
        skipLibCheck: true,
      },
      include: ["src", "runtime", "tests"],
    }, null, 2) + "\n",

    ".gitignore": "node_modules/\ndist/\n",

    "README.md": `# ${slug}\n\nTODO: what this teaches, and the credential it needs.\n\n\`\`\`sh\nnpm install\nnpm start\n\`\`\`\n`,

    "src/cli.ts": `/**
 * TODO: what this example is, and why it is a CLI.
 *
 * The runner is in \`../runtime/cli-runtime.ts\`, byte-identical in every example. This file is the
 * part that is about ${slug}.
 */

import { runCli, type Command } from "../runtime/cli-runtime.js";

const MODEL = process.env.THEOKIT_MODEL ?? "openai-chatgpt/gpt-5.4-mini";

const COMMANDS: Record<string, Command> = {
  // TODO: one entry per command. \`needs: "text"\` refuses an empty argument.
};

await runCli({
  title: "theokit ${slug} example — TODO",
  commands: COMMANDS,
  footer: \`Set THEOKIT_MODEL to use a different provider (currently \${MODEL}).\`,
});
`,

    "src/minimal.ts": `// #region lesson:minimal
// TODO: the fewest lines that work, with the comments a reader of the skill will see.
export {};
// #endregion
`,

    "src/pitfalls.ts": `// #region lesson:pitfall-todo
// TODO: a mistake this example made, the symptom it produced, and the correct form.
export {};
// #endregion
`,

    [`tests/${slug}.test.ts`]: `/**
 * The proof that this example works, run against a real agent with no credential.
 *
 * Every lesson \`skill.json\` declares needs a test that NAMES it — \`proof\` fails the contract check
 * otherwise. A lesson is code the generator copies verbatim into a skill, so a lesson nobody
 * executes is a claim published to agents that cannot check it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { startFakeProvider } from "../runtime/fake-provider.js";

test("lesson minimal: TODO what it proves", async () => {
  const fake = await startFakeProvider({ reply: "ok" });
  try {
    // TODO: run the example's own code against \`fake.model\`, then assert.
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
});

test("lesson core-${slug}: TODO what it proves", () => {
  assert.ok(true, "TODO");
});

test("lesson pitfall-todo: TODO what it proves", () => {
  assert.ok(true, "TODO");
});
`,

    [`src/${slug}.ts`]: `// #region lesson:core-${slug}
// TODO: the central gesture of this domain.
export {};
// #endregion
`,
  };

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  for (const name of canonicalFiles()) {
    copyFileSync(join(DRIVER, name), join(dir, "runtime", name));
  }

  console.log(`scaffolded ${target}

Next:
  1. pin @theokit/sdk to an exact version in package.json, then npm install
  2. write the lessons, replacing every TODO
  3. write a test naming each lesson — see sdk/memory/tests/
  4. npm start            usage prints and exits 0
  5. npm test             the lessons run against the fake provider, no credential
  6. npm run check        from the repository root
`);
}

const [target] = process.argv.slice(2);
if (target === undefined || target === "--sync") sync();
else scaffold(target);
