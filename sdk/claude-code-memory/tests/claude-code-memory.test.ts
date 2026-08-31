/**
 * Conformance against the Claude Code CLI, asserted rather than assumed.
 *
 * Nothing here needs a credential or a logged-in CLI: the SDK's writer runs for real, and the CLI
 * side is the RECORDING in `claude-code-memory.ts`, taken from a live `claude 2.1.236` session.
 * `npm start -- oracle` is what refreshes that recording — see `variant-recapture-the-oracle`,
 * which cannot be a test for the same reason it is a command.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { memoryReadRoots } from "@theokit/sdk/internal/memory-store";

import { CLAUDE_CODE_LAYOUT, describeStore, divergencesFromClaudeCode } from "../src/claude-code-memory.js";
import { KEYED_BY } from "../src/pitfalls.js";
import { writeOneAndDescribe } from "../src/minimal.js";

let cwd: string;
before(async () => {
  cwd = await mkdtemp(join(tmpdir(), "conformance-"));
});
after(async () => {
  await rm(cwd, { recursive: true, force: true });
});

test("lesson minimal: one write produces an index and a file per memory", async () => {
  const { shape } = await writeOneAndDescribe(cwd);
  assert.ok(shape.files.includes("MEMORY.md"), "an index is written");
  assert.equal(shape.files.length, 2, "MEMORY.md plus exactly one memory");
  assert.equal(shape.indexEntries.length, 1, "the index names the memory");
  assert.match(shape.indexEntries[0]?.target ?? "", /\.md$/, "and points at its file");
});

test("lesson core-describe-a-store: a store that is not there describes as empty, never throws", async () => {
  // The whole point of this example is a store that is not where somebody looked. If describing one
  // threw, the case that matters could only be observed as a crash.
  const shape = await describeStore(join(cwd, "nowhere", "at", "all"));
  assert.deepEqual(shape.files, []);
  assert.deepEqual(shape.indexEntries, []);
});

test("lesson core-the-recorded-oracle: the SDK diverges from the CLI in exactly three ways today", async () => {
  const { divergences } = await writeOneAndDescribe(cwd);

  // Pinned deliberately. This is the current, measured state — not the desired one. When the SDK
  // stops writing `observations`, starts writing `originSessionId`, or drops the index heading,
  // this test fails and the number here is what a reader updates. A test asserting "no divergence"
  // would be a wish, and would have been red from the day it was written.
  assert.equal(divergences.length, 3, divergences.join("\n"));
  assert.ok(divergences.some((d) => d.includes("heading")), "the index heading");
  assert.ok(divergences.some((d) => d.includes("originSessionId")), "a key the CLI writes");
  assert.ok(divergences.some((d) => d.includes("observations")), "a key the CLI does not");
});

test("lesson pitfall-empty-memory-dir: an empty memory directory is indistinguishable from no store", async () => {
  const empty = join(cwd, "empty-store", "memory");
  await mkdir(empty, { recursive: true });

  const present = await describeStore(empty);
  const absent = await describeStore(join(cwd, "no-store-at-all", "memory"));

  // Identical descriptions. This is why counting directories that HAVE `memory/` answered a
  // different question than the one being asked, and produced a confident wrong answer.
  assert.deepEqual(present, absent, "existence is not evidence; only files are");
});

test("lesson pitfall-git-root-keying: the SDK's Claude root follows cwd, not the repository", () => {
  const repo = join(cwd, "repo");
  const nested = join(repo, "nested", "deep");

  const roots = memoryReadRoots(nested).join("\n");

  // The measured divergence, asserted so it cannot be fixed silently: the Claude Code read root the
  // SDK derives carries the SUBDIRECTORY, while two real sessions put the memory on the repo root.
  // theokit-sdk#479. When that is fixed this assertion flips, and it should — a green here today
  // means the defect is still present, which is the honest state.
  assert.ok(roots.includes("nested-deep"), "the SDK keys the Claude store by cwd");
  assert.equal(KEYED_BY.claudeAutoMemory, "git repository root", "the CLI keys it by the repo");
  assert.notEqual(KEYED_BY.transcripts, KEYED_BY.claudeAutoMemory, "two axes, one encoder — the defect");
});

test("lesson pitfall-documentation-is-not-the-oracle: the recording names the version it came from", async () => {
  assert.match(CLAUDE_CODE_LAYOUT.capturedFrom, /^claude \d+\.\d+\.\d+$/);
  assert.match(CLAUDE_CODE_LAYOUT.capturedOn, /^\d{4}-\d{2}-\d{2}$/);

  // And the shape it recorded is the shape it checks against — a real index line from that session.
  assert.match(
    "- [Test runner: vitest pinned](test-runner-vitest-pinned.md) — vitest fixed at 1.2.3.",
    CLAUDE_CODE_LAYOUT.indexEntryShape,
  );
});

/**
 * `variant-recapture-the-oracle` is NOT tested here, and that is the honest option.
 *
 * It drives a real logged-in `claude` through tmux: it needs a credential this suite refuses to
 * require, spends the operator's tokens, and takes about two minutes. A test that skips itself
 * whenever the CLI is absent would report green on every machine that cannot run it, which is the
 * failure this whole example is about. It is exercised by running `npm start -- oracle`.
 */
test("lesson variant-recapture-the-oracle: the capture is a command, and the suite says why", async () => {
  const store = join(cwd, "manual-capture", "memory");
  await mkdir(store, { recursive: true });
  await writeFile(join(store, "MEMORY.md"), "- [A fact](a-fact.md) — the hook.\n");
  await writeFile(
    join(store, "a-fact.md"),
    "---\nname: a-fact\ndescription: a fact\nmetadata:\n  node_type: memory\n  type: project\n  originSessionId: x\n  modified: 2026-08-31T00:00:00.000Z\n---\n\nbody\n",
  );

  // What `oracle` produces is a directory in this shape; `describeStore` is what reads it, so the
  // reader half is proven here even though the capture half needs a session.
  const shape = await describeStore(store);
  assert.equal(shape.indexHasHeading, CLAUDE_CODE_LAYOUT.indexHasHeading);
  assert.deepEqual(shape.frontmatterKeys, [...CLAUDE_CODE_LAYOUT.frontmatterKeys]);
  assert.deepEqual(divergencesFromClaudeCode(shape), [], "a real CLI store has no divergence");
});
