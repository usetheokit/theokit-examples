// #region lesson:variant-declared-provider
import { AgentBuilder } from "@theokit/agents";
import { Provider } from "@theokit/sdk";
import { z } from "zod";

/**
 * A SECOND AGENT IS A SECOND FILE — this one is `POST /api/agents/declared-provider`, and it needed
 * no more registration than the first.
 *
 * It also shows the way out of `pitfall-provider-registry`. The framework will not route a model id
 * whose provider nobody named; declaring the SDK's catalog is how you name them:
 *
 *   .plugins(Provider.builtins())     // 45 providers, measured
 *
 * With that line, `lmstudio/…` — refused in `chat.ts` — resolves. Without it, an app still gets
 * `declares provider "lmstudio", which is not registered`, and that refusal is deliberate: a turn
 * must never succeed against a provider the app did not ask for.
 *
 * `Provider` comes from `@theokit/sdk`, not from `@theokit/agents`. The builder takes the plugins;
 * the catalog is the runtime's.
 *
 * KEYLESS PROVIDERS NEED NO KEY, and that is worth knowing because it was briefly untrue. On
 * theokit 0.62.0 this same file was refused with `LMSTUDIO_API_KEY is not set`, even though the
 * catalog declares `lmstudio` and `llamacpp` as `authType: "none"` — the credential gate read
 * "has a named env var" as "needs a credential", and any string satisfied it. Fixed in 0.62.1
 * (theokit#585) by reading `authType`, which is the field that answers the question. On an older
 * version, running a local model through an app means setting a variable nobody reads.
 */
export default AgentBuilder.create()
  .input(z.object({ message: z.string() }))
  .plugins(Provider.builtins())
  .model(process.env.DECLARED_MODEL ?? "lmstudio/lmstudio-community/default")
  .system("You answer in one short sentence.")
  .build();

export const policy = "public";
// #endregion
