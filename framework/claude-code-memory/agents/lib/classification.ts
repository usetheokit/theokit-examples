/**
 * The one property this example asserts, read directly.
 *
 * `sdk/claude-code-memory` carries a full `StoreShape` reader because it compares seven properties
 * against a recording. This side asks ONE question — did the memory get a `type`? — so it reads the
 * frontmatter line instead of describing the whole store. A copy of the larger reader would be
 * forty lines to answer a question one regex answers, and the two examples are separate npm
 * projects, so it would be a copy that drifts rather than a shared module.
 */

// #region lesson:core-the-kind-comes-from-the-callers-text
/**
 * The Claude Code CLI records the kind of every memory as `metadata.type`, one of four values. The
 * SDK writes that field ONLY when the fact carries a kind — and the kind is parsed from the user's
 * text, not decided by the agent:
 *
 *   "Remember: X"             -> stored, no `type`
 *   "Remember (project): X"   -> stored, `type: project`
 *
 * MEASURED through a real `theokit dev` server, both forms, same agent. The framework changes
 * nothing about this; it just moves who is holding the switch.
 *
 * **In a served app the caller builds the request body.** So whether a memory is classifiable the
 * way the CLI classifies its own is decided by the browser, the client, or the other service that
 * composed the message — not by the agent file, and not by the framework. A UI that sends a bare
 * `Remember:` produces a store the CLI can read and cannot categorise.
 */
export const KINDS = ["user", "feedback", "project", "reference"] as const;

/** The `metadata.type` of a memory file, or `undefined` when the fact carried no kind. */
export function classificationOf(memoryFile: string): string | undefined {
  const end = memoryFile.indexOf("\n---", 4);
  const frontmatter = memoryFile.startsWith("---\n") && end !== -1 ? memoryFile.slice(4, end) : "";
  return /^\s+type:\s*(\S+)/m.exec(frontmatter)?.[1];
}
// #endregion

// #region lesson:pitfall-csrf-header
/** A state-changing route is CSRF-protected by default; a hand-built request must send this. */
export const AGENT_REQUEST_HEADERS = {
  "content-type": "application/json",
  "X-Theo-Action": "1",
} as const;
// #endregion
