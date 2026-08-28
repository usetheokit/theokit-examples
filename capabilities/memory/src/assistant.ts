// #region skill:create-agent-with-memory
import { Agent, PermissionEngine, PermissionPlugin } from "@theokit/sdk";

/**
 * A project assistant that keeps what it learns in the working directory.
 *
 * The whole memory setup is `memory: { enabled: true }`. The store is `<cwd>/.theokit/memory/` —
 * markdown files with frontmatter, versionable, readable, editable by hand. There is no server to
 * run and no database to provision.
 */
export interface AssistantOptions {
  /** Where the memory store lives. Its own directory, so it can be committed or ignored. */
  readonly projectDir: string;
  readonly model: string;
  /**
   * Register the permission layer.
   *
   * Default ON here, which is not the SDK's default and is the single most important line in this
   * example. Memory is a file directory: anything that can write to it can put a sentence in front
   * of the agent at the start of every future session. Measured over 6 runs, a planted entry
   * phrased as standing policy was enough for the agent to perform the action it described in 2 of
   * them — and 0 of 6 with this layer registered. `npm start -- demo:poisoned` runs both.
   */
  readonly enforcePermissions?: boolean;
}

export async function createAssistant(options: AssistantOptions) {
  const { projectDir, model, enforcePermissions = true } = options;

  return Agent.create({
    model: { id: model },
    local: { cwd: projectDir },
    memory: { enabled: true },
    // An engine with no rules resolves every tool call to `ask`; with no gate configured to
    // answer, it blocks. The protection is the engine being present, not a rule written in
    // advance against an attack nobody predicted.
    ...(enforcePermissions
      // An EMPTY ARRAY, not `{ rules: [] }`. The constructor takes the rules positionally, and the
      // object form typechecks nowhere and silently constructs an engine with no usable rule list.
      // A `.mjs` proof script in this project passed the object form for weeks and still observed
      // "nothing was created" — the right answer for the wrong reason, which is the failure mode
      // TypeScript exists to prevent.
      ? { plugins: [PermissionPlugin.create(new PermissionEngine([]))] }
      : {}),
  });
}
// #endregion

// #region skill:ask-and-wait
/**
 * Send one message and return what the agent said.
 *
 * TWO CALLS, not one. `send` starts a run and hands back a HANDLE — its `status` is `"running"`
 * and its `result` is empty. The answer arrives from `wait()`.
 *
 * This example was written with `await agent.send(...)` alone and read the text straight off the
 * return value. It printed nothing, twice, while the memory file was written correctly on disk —
 * a failure that looks like "memory is broken" and is really "the run had not finished". The
 * separation is deliberate in the SDK, because a caller may want to stream a run rather than block
 * on it, but it is the first thing a newcomer gets wrong.
 */
export async function ask(
  agent: Awaited<ReturnType<typeof createAssistant>>,
  message: string,
): Promise<string> {
  const run = await agent.send(message);
  const finished = await run.wait();
  return finished.result?.trim() ?? "(the run finished with no text)";
}
// #endregion
