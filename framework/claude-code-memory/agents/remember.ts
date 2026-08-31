// #region lesson:core-a-served-agent-writes-the-same-store
import { AgentBuilder } from "@theokit/agents";
import { z } from "zod";

/**
 * A served agent with memory on, so the store it writes can be read and compared.
 *
 * This is the framework half of `sdk/claude-code-memory`. The SDK half writes with `appendFact` and
 * asks whether the LAYOUT matches the Claude Code CLI's. The question here is different and cannot
 * be asked on that side: **does the layout survive the trip through a served agent?**
 *
 * It does. Measured against `@theokit/sdk@4.63.1` and `theokit@0.63.0`, the store a served agent
 * writes is byte-shaped like the one a direct call writes — same index, same frontmatter keys.
 * What varies is not the layer.
 */
export default AgentBuilder.create()
  .input(z.object({ message: z.string() }))
  .model(process.env.LLM_MODEL ?? "ollama/llama3.2")
  .memory({ enabled: true, directory: process.env.MEMORY_DIR })
  .system("You answer in one short sentence.")
  .build();
// #endregion

// #region lesson:setup-agent-policy
/**
 * Declared, and it is the declaration the framework's route gate reads. `'public'` is a decision:
 * this endpoint runs for an unauthenticated caller, and with memory on, what that exposes is the
 * store rather than one reply.
 */
export const policy = "public";
// #endregion
