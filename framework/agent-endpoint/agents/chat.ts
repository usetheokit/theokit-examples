// #region lesson:core-agent-as-a-file
import { AgentBuilder } from "@theokit/agents";
import { z } from "zod";

/**
 * THIS FILE IS THE ENDPOINT. Saving it at `agents/chat.ts` serves it at `POST /api/agents/chat`.
 *
 * Nothing registers it. There is no router to touch, no server file to edit, no config entry, no
 * decorator naming the path. The framework scans `agents/` and the file's path IS the route — so
 * `agents/support.ts` would be `POST /api/agents/support`, and a second agent is a second file.
 *
 * That is the part a coding agent gets wrong, because in every other framework this needs a
 * handler that receives the request, validates it, calls the model and streams the reply back.
 * Here there is no handler to write: what you export from this file is the whole endpoint.
 *
 * The browser binds by the same name — `useAgent('/api/agents/chat')` — and gets the stream.
 */
export default AgentBuilder.create()
  // The request body, validated at the boundary before the agent sees it. A body that does not
  // match is rejected by the framework; the agent is never invoked with input it did not declare.
  .input(z.object({ message: z.string() }))
  // Read from the environment HERE, in the file that decides it — not by the framework. The
  // literal is the fallback, because an example has to run with nothing set.
  .model(process.env.LLM_MODEL ?? "ollama/llama3.2")
  .system("You answer in one short sentence.")
  .build();
// #endregion

// #region lesson:setup-agent-policy
/**
 * Who may run this agent, and against which conversation. Every agent declares it, and `'public'`
 * is a decision rather than the absence of one.
 *
 * It means the endpoint resumes whatever conversation the caller names, so anyone holding a
 * session id may read and continue it. That is a capability model, and it is honest for an example
 * with no login. The moment an app has users, this becomes an owner check instead:
 *
 *   import { requireOwner } from 'theokit/server/define'
 *   export const policy = ({ subject, params }) =>
 *     requireOwner(subject, ownerOfConversation(params.sessionId))
 *
 * One declaration covers the run, the thread routes, the approval surface and MCP.
 */
export const policy = "public";
// #endregion
