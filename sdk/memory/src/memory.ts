// #region lesson:core-create-agent-with-memory
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
    // advance against an attack nobody predicted. The rules are POSITIONAL — passing them as an
    // options object builds an engine with no usable rule list, see `pitfall-permission-engine-shape`.
    ...(enforcePermissions
      ? { plugins: [PermissionPlugin.create(new PermissionEngine([]))] }
      : {}),
  });
}
// #endregion

// #region lesson:core-ask-and-wait
/**
 * Send one message and return what the agent said.
 *
 * TWO CALLS, not one: `send` starts the run and hands back a handle, `wait` produces the text.
 * Reading the text off `send`'s return value is the first thing a newcomer gets wrong, and the
 * symptom points at the wrong half of the system — see `pitfall-send-returns-handle`.
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
