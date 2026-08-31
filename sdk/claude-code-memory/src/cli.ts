/**
 * Does the SDK write memory the way the Claude Code CLI does?
 *
 * A CLI because the answer is a comparison a reader runs, not a value they read. `compare` needs no
 * credential and no CLI login — it writes a store with the SDK and diffs its shape against a
 * recording of a real session. `oracle` re-takes that recording, and is the one command that needs
 * a logged-in `claude` on PATH.
 *
 * The runner is in `../runtime/cli-runtime.ts`, byte-identical in every example. This file is the
 * part that is about the comparison.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli, type Command } from "../runtime/cli-runtime.js";
import { CLAUDE_CODE_LAYOUT, describeStore, divergencesFromClaudeCode } from "./claude-code-memory.js";
import { writeOneAndDescribe } from "./minimal.js";
import { captureFromRealSession } from "./oracle.js";

const COMMANDS: Record<string, Command> = {
  compare: {
    takes: "",
    needs: "none",
    note: "no credential, no CLI login — writes a store and diffs its shape",
    run: async () => {
      const cwd = await mkdtemp(join(tmpdir(), "theokit-conformance-"));
      try {
        const { shape, divergences } = await writeOneAndDescribe(cwd);
        console.log(`files:      ${shape.files.join(", ")}`);
        console.log(`index:      ${shape.indexEntries.length} entry(ies), heading: ${shape.indexHasHeading}`);
        console.log(`frontmatter ${shape.frontmatterKeys.join(", ")}`);
        console.log("");
        console.log(`against ${CLAUDE_CODE_LAYOUT.capturedFrom}, captured ${CLAUDE_CODE_LAYOUT.capturedOn}:`);
        if (divergences.length === 0) console.log("  no divergence");
        for (const d of divergences) console.log(`  - ${d}`);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    },
  },

  describe: {
    takes: '"<path to a memory directory>"',
    needs: "text",
    run: async (dir) => {
      const shape = await describeStore(dir);
      if (shape.files.length === 0) {
        // Not an error. "The store is not where I looked" is the finding this example exists for,
        // and reporting it as a crash would hide the case that matters.
        console.log(`no memory files under ${dir}`);
        return;
      }
      console.log(JSON.stringify(shape, null, 2));
    },
  },

  oracle: {
    takes: "",
    needs: "none",
    note: "drives a real logged-in `claude` in tmux; takes ~2 minutes and spends tokens",
    run: async () => {
      const result = await captureFromRealSession();
      console.log(JSON.stringify(result, null, 2));
    },
  },
};

await runCli({
  title: "theokit claude-code-memory example — does the SDK write what the CLI writes?",
  commands: COMMANDS,
  footer:
    "`compare` and `describe` need nothing installed. `oracle` drives a real logged-in `claude` in tmux.",
});
