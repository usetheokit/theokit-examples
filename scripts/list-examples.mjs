#!/usr/bin/env node
/**
 * Print every example directory as JSON, for the CI matrix to consume.
 *
 *   npm run examples:list      ["framework/agent-endpoint", "sdk/memory", …]
 *
 * Discovery is `discoverExamples` — the same function the index generator and the structure checker
 * use, so a directory the checker validates cannot be a directory CI skips.
 *
 * The matrix was a hand-written list, and its own comment said the risk out loud: *"adding a
 * directory without adding it here means it is not checked."* What actually happened was worse than
 * a missing entry — a rename left the list naming `capabilities/memory`, a directory that no longer
 * existed, so every run failed on `npm ci` in a path that was not there while four real examples
 * went unchecked. A list somebody must remember to update cannot report its own staleness.
 */

import { discoverExamples } from "./build-index.mjs";

const examples = discoverExamples().map((e) => e.dir);
if (examples.length === 0) {
  process.stderr.write("no example found — a directory holding a skill.json is what counts\n");
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(examples)}\n`);
