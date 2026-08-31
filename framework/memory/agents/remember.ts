// #region lesson:core-memory-on-an-agent-file
import { AgentBuilder } from "@theokit/agents";
import { z } from "zod";

/**
 * THE SAME CAPABILITY AS `sdk/memory`, ON THE OTHER SIDE OF THE FRAMEWORK.
 *
 * In the SDK example memory survives between two PROCESSES. Here it survives between two HTTP
 * REQUESTS, which is the shape a served agent actually meets: every request builds the agent from
 * this file again, and nothing is carried over in memory-the-language-feature. What carries the
 * fact is memory-the-capability — a directory of markdown on disk.
 *
 * `.memory(...)` takes the SDK's `MemorySettings` unchanged. There is no framework-shaped wrapper
 * around it and no second vocabulary to learn: what you would pass to `Agent.create({ memory })`
 * is what you pass here.
 */
export default AgentBuilder.create()
  .input(z.object({ message: z.string() }))
  .model(process.env.LLM_MODEL ?? "ollama/llama3.2")
  .memory({
    enabled: true,
    // WHERE the store lives, forwarded verbatim to the SDK.
    //
    // This is the half that used to go missing. The framework accepted a memory setting and the
    // durable store went somewhere else, so an app could configure a location and be quietly
    // ignored (theokit#557). It is honoured from `@theokit/sdk@4.63.0` on, which is why this
    // example pins that version and not an earlier one.
    //
    // Absolute, or starting with `~/`. A relative path is REFUSED rather than resolved, because
    // "relative to what" has two plausible answers — the process's cwd and the app's root — and
    // they put the store in two different places.
    directory: process.env.MEMORY_DIR,
  })
  .system("You answer in one short sentence.")
  .build();
// #endregion

// #region lesson:setup-agent-policy
/**
 * Memory makes this declaration matter more than it does on a stateless agent.
 *
 * `'public'` means the endpoint resumes whatever conversation the caller names — and now that the
 * agent remembers, what it resumes includes everything previously written to the store. A capability
 * model over a stateless agent leaks a reply; over a remembering one it leaks a history.
 *
 * For an example with no login this is the honest setting, stated rather than defaulted into. The
 * moment an app has users, the store is per-user and this becomes an owner check.
 */
export const policy = "public";
// #endregion
