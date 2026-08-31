/**
 * Three ways a reader concludes the wrong thing about where memory lives. All three were made
 * while writing this example, and all three were only caught by measuring.
 */

// #region lesson:pitfall-git-root-keying
/**
 * The SDK reads the Claude Code store keyed by `cwd`. The CLI writes it keyed by the GIT ROOT.
 *
 * MEASURED with two real `claude 2.1.236` sessions driven in tmux from subdirectories of a fresh
 * repo. Both times the memory landed on the repo root's directory, and the subdirectory's project
 * directory got only the session `.jsonl` — no `memory/` at all:
 *
 *   ~/.claude/projects/-tmp-probe-repo/memory              MEMORY.md + 3 facts
 *   ~/.claude/projects/-tmp-probe-repo-nested/memory       does not exist
 *   ~/.claude/projects/-tmp-probe-repo-nested-deep/memory  does not exist
 *
 * So an SDK agent started anywhere below the repo root reads a directory the CLI never wrote to,
 * finds nothing, and reports nothing. It does not throw and does not warn: the observation is
 * identical to an empty store.
 *
 * TRANSCRIPTS are keyed by `cwd`, and correctly so — the two artefacts live on different axes, and
 * conflating them is what produced the defect. Tracked as theokit-sdk#479.
 */
export const KEYED_BY = { transcripts: "cwd", claudeAutoMemory: "git repository root" } as const;
// #endregion

// #region lesson:pitfall-empty-memory-dir
/**
 * An empty `memory/` directory proves NOTHING about where the CLI keeps memory.
 *
 * This is the mistake that produced the wrong answer above, and it is worth more than the fix.
 * Counting project directories that HAVE a `memory/` gives one answer; counting those with a `.md`
 * inside gives another:
 *
 *   139 project directories have `memory/`
 *   111 of them hold any `.md`
 *
 * The four directories originally cited as proof that the CLI keys by `cwd` all had `memory/` and
 * all held zero files. The conclusion was drawn from directory names and survived review because
 * nothing about it looked like a guess.
 *
 * Count content, never containers.
 */
export const MEMORY_DIR_IS_NOT_EVIDENCE =
  "a memory/ directory can exist and be empty; only files prove a write";
// #endregion

// #region lesson:pitfall-documentation-is-not-the-oracle
/**
 * Asserting against the documentation proves the documentation, not the CLI.
 *
 * A reader can already read the page. What nobody can check without a real session is whether the
 * installed CLI still behaves the way the page describes — and here the two disagreed with the
 * SDK's code for at least two releases while every test stayed green.
 *
 * So the oracle in `claude-code-memory.ts` is a RECORDING of a real run, carrying the version it
 * came from, and `npm start -- oracle` re-takes it. A recording ages; a claim about a version does
 * not pretend otherwise.
 */
export const ORACLE_IS_A_RECORDING = "captured from a running CLI, with the version it came from";
// #endregion
