/**
 * The mistakes that make a remembering agent look broken.
 *
 * This file is in `agents/lib/` for the reason `framework/agent-endpoint` explains: a `.ts` under
 * `agents/` becomes a route, so `agents/pitfalls.ts` would be served at
 * `POST /api/agents/pitfalls`. `lib` is one of the thirteen reserved composition names, and
 * `memory` is another — a directory named `agents/memory/` is never a route either.
 */

// #region lesson:pitfall-csrf-header
/**
 * A state-changing route is CSRF-protected by default. Without the header the answer is
 * `403 CSRF_FAILED`, which reads as "the agent is broken" and is really "the request never
 * reached one". `useAgent` and the typed client send it; a raw `fetch`, a curl or a test must.
 */
export const AGENT_REQUEST_HEADERS = {
  "content-type": "application/json",
  "X-Theo-Action": "1",
} as const;
// #endregion

// #region lesson:pitfall-relative-directory
/**
 * A RELATIVE `directory` writes nothing, and tells nobody.
 *
 * The store must be absolute or start with `~/`, because *relative to what* has two plausible
 * answers in a served app — the process's working directory and the project root the framework
 * resolved — and they are different directories. The SDK refuses rather than picking one.
 *
 * MEASURED, because every guess about WHERE that refusal surfaces is wrong:
 *
 *   .memory({ enabled: true, directory: "./memory" })
 *
 *   Agent.create()   -> does NOT throw
 *   theokit dev      -> starts normally, prints its port
 *   first request    -> HTTP 200, an ordinary reply, no error in the stream
 *   the disk         -> nothing at ./memory, nothing at the SDK's default store
 *
 * The refusal is real and it is reported through the SDK's diagnostics sink, which is silent unless
 * the host installs one. So a served app with this typo answers every request correctly and
 * remembers nothing, forever, with no signal anywhere a caller or an operator would look.
 *
 * That is why this is the pitfall worth the space. An exception would be a good day: the mistake
 * would announce itself on the first request. This announces itself the week somebody notices the
 * agent has never learned anything.
 */
export const ACCEPTED_DIRECTORY_FORMS = ["/var/lib/app/memory", "~/.local/share/app/memory"] as const;
// #endregion

// #region lesson:pitfall-writes-need-an-instruction
/**
 * The agent does not decide to remember. A durable entry traces to the USER'S text — a message
 * beginning `Remember:` is what makes one — and never to the model choosing that something was
 * worth keeping.
 *
 * So an agent that "will not remember" is usually an agent nobody asked to. This matters more
 * behind HTTP than it does in a script: the caller writing the request body is the one holding
 * that switch, and if the UI never sends the instruction, no amount of memory configuration
 * produces an entry.
 */
export const WRITE_INSTRUCTION_PREFIX = "Remember:";
// #endregion
