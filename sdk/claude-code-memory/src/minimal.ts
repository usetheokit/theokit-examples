// #region lesson:minimal
import { appendFact } from "@theokit/sdk/internal/memory-store";

import { describeStore, divergencesFromClaudeCode } from "./claude-code-memory.js";

/**
 * The smallest thing that works: write one memory, then look at what landed on disk.
 *
 * `appendFact` is the SDK's writer. Its second argument is the memory config and is NOT optional —
 * passing `undefined` throws `Cannot read properties of undefined (reading 'enabled')`, which reads
 * like a bug in your data and is a missing argument.
 */
export async function writeOneAndDescribe(cwd: string) {
  await appendFact(
    cwd,
    { enabled: true },
    { text: "This project pins vitest at 1.2.3 and never uses jest", kind: "project" },
  );

  // `<cwd>/.theokit/memory` is the default store. The SDK reads more roots than it writes to —
  // see `pitfall-git-root-keying` for the one it reads that the Claude Code CLI does not write.
  const shape = await describeStore(`${cwd}/.theokit/memory`);

  return { shape, divergences: divergencesFromClaudeCode(shape) };
}
// #endregion
