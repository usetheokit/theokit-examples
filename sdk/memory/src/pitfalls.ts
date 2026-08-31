/**
 * The two mistakes this example made before it worked, each runnable.
 *
 * Both were found by running the code, not by reading the types, and both produce output that
 * points at the wrong culprit — which is why they are here as commands you can execute rather
 * than as a warning in a README nobody opens at the moment they bite.
 */

import { Agent, PermissionEngine } from "@theokit/sdk";

type Assistant = Awaited<ReturnType<typeof Agent.create>>;

// #region lesson:pitfall-send-returns-handle
/**
 * `send()` does not return the answer. It starts a run and hands back a HANDLE whose `status` is
 * `"running"` and whose `result` is empty. The text arrives from `wait()`.
 *
 *   WRONG — compiles, runs, prints nothing:
 *     const answer = await agent.send(message);
 *     console.log(answer.result);            // empty: the run has not finished
 *
 * This example was written that way and printed nothing, twice, while the memory file on disk was
 * written correctly. The failure reads as "memory is broken" and is really "the run had not
 * finished" — so the time goes into the wrong half of the system.
 *
 * The separation is deliberate: a caller may want to stream a run rather than block on it.
 */
export async function demonstrateSendReturnsHandle(
  agent: Assistant,
  message: string,
): Promise<{ afterSend: string; afterWait: string; text: string | undefined }> {
  const run = await agent.send(message);
  const afterSend = run.status;

  const finished = await run.wait();
  return { afterSend, afterWait: finished.status, text: finished.result };
}
// #endregion

// #region lesson:pitfall-permission-engine-shape
/**
 * `PermissionEngine` takes its rules POSITIONALLY — an array, not an options object.
 *
 *   WRONG — does NOT throw, and that is what makes it dangerous:
 *     new PermissionEngine({ rules: [...] })
 *
 * Measured against @theokit/sdk 4.61.0 by the command below: the object form constructs, and
 * stores the whole options object in the field meant to hold the array. The engine then holds a
 * `rules` that is not a list, so no rule can ever match — a silent no-op wearing the shape of a
 * configured gate. There is no exception to catch and no log line to notice.
 *
 * A `.mjs` proof script in this project passed the object form for weeks and still observed
 * "nothing was created" — the right answer for the wrong reason. The object form typechecks
 * nowhere, which is exactly why the example is TypeScript: `strict` is what catches it.
 *
 * An engine with an EMPTY array is not a no-op: with no rule matching, every tool call resolves to
 * `ask`, and with no gate configured to answer, it blocks. The protection is the engine being
 * present — not a rule written in advance against an attack nobody predicted.
 */
export function demonstratePermissionEngineShape(): { positional: unknown; objectForm: unknown } {
  const rule = { tool: "shell", action: "deny" };

  const positional = new PermissionEngine([rule as never]);
  // @ts-expect-error — the object form is what this pitfall is about; it typechecks nowhere.
  const objectForm = new PermissionEngine({ rules: [rule] });

  const rulesOf = (engine: unknown) => (engine as { rules: unknown }).rules;
  return { positional: rulesOf(positional), objectForm: rulesOf(objectForm) };
}
// #endregion
