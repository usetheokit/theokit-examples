// #region lesson:minimal
import { Agent } from "@theokit/sdk";

/**
 * Memory, in the fewest lines that work.
 *
 * One option turns it on. The store is `<projectDir>/.theokit/memory/` — one markdown file per
 * memory plus a `MEMORY.md` index. No server, no database, nothing to provision.
 *
 * Run this twice in two separate processes, with `remember` first and `recall` second, and the
 * answer can only have come from disk: nothing else survives between them.
 */
export async function remember(projectDir: string, model: string, fact: string): Promise<void> {
  const agent = await Agent.create({
    model: { id: model },
    local: { cwd: projectDir },
    memory: { enabled: true },
  });

  // "Remember:" is what makes an entry. The agent does not decide to remember on its own.
  const run = await agent.send(`Remember (project): ${fact}`);
  await run.wait();
}

export async function recall(projectDir: string, model: string, question: string): Promise<string> {
  const agent = await Agent.create({
    model: { id: model },
    local: { cwd: projectDir },
    memory: { enabled: true },
  });

  const run = await agent.send(question);
  const finished = await run.wait();
  return finished.result?.trim() ?? "";
}
// #endregion
