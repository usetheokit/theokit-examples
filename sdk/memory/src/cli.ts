/**
 * A project assistant you run from your terminal.
 *
 *   npm start -- learn "deploys go through the release branch, never main"
 *   npm start -- ask   "which branch do deploys go through?"
 *
 * The two commands are SEPARATE PROCESSES. Nothing is shared between them but the directory on
 * disk — no conversation, no transcript, no handle held open. If the second one answers, memory
 * is the only path the answer could have taken.
 *
 * That is why this is a CLI and not a script that creates two agents in one run: an in-process
 * second agent proves less, because a reader cannot tell what else the process kept alive.
 *
 * The runner is in `../runtime/cli-runtime.ts`, byte-identical in every example and deliberately
 * outside `src/`. This file is the part that is about memory.
 */

import { resolve } from "node:path";

import { runCli, type Command } from "../runtime/cli-runtime.js";
import { ask, createAssistant } from "./memory.js";
import { recall, remember } from "./minimal.js";
import {
  demonstratePermissionEngineShape,
  demonstrateSendReturnsHandle,
} from "./pitfalls.js";
import { runPoisonedDemo } from "./poisoned-demo.js";
import { verifyPermissions } from "./verify-permissions.js";

/**
 * The shared local server, so the example runs with no API key at all.
 *
 * One Ollama on `localhost:11434` serves every example in this repository — it is a system daemon,
 * not something an example starts. `ollama/llama3.2` is what the SDK's own catalog names as this
 * provider's model, so the id here and the id the SDK expects cannot drift.
 *
 * `THEOKIT_MODEL` still points anywhere: a hosted model with your credential is strictly better at
 * the recall this example demonstrates (see the README's note on how often 3B gets it right).
 */
const MODEL = process.env.THEOKIT_MODEL ?? "ollama/llama3.2";
/** The project this assistant remembers things about. Its own directory keeps the store visible. */
const PROJECT_DIR = resolve(process.env.THEOKIT_PROJECT_DIR ?? "./workspace");

const COMMANDS: Record<string, Command> = {
  learn: {
    takes: '"<something about your project>"',
    needs: "text",
    run: async (text) => {
      const agent = await createAssistant({ projectDir: PROJECT_DIR, model: MODEL });
      // "Remember:" is what makes a write happen. The agent does not decide to remember on its own
      // and does not mine the conversation for facts — every entry traces to an explicit
      // instruction. That is a design decision with a cost worth knowing: nothing is kept unless
      // someone asks.
      console.log(await ask(agent, `Remember (project): ${text}`));
    },
  },

  ask: {
    takes: '"<a question>"',
    needs: "text",
    run: async (question) => {
      const agent = await createAssistant({ projectDir: PROJECT_DIR, model: MODEL });
      console.log(await ask(agent, question));
    },
  },

  "minimal:learn": {
    takes: '"<something>"',
    needs: "text",
    note: "the same thing, in the fewest lines",
    run: async (text) => {
      await remember(PROJECT_DIR, MODEL, text);
      console.log("remembered");
    },
  },

  "minimal:ask": {
    takes: '"<a question>"',
    needs: "text",
    run: async (question) => {
      console.log(await recall(PROJECT_DIR, MODEL, question));
    },
  },

  "pitfall:send": {
    takes: '"<a question>"',
    needs: "text",
    note: "what send() returns before wait()",
    run: async (question) => {
      const agent = await createAssistant({ projectDir: PROJECT_DIR, model: MODEL });
      const observed = await demonstrateSendReturnsHandle(agent, question);
      console.log(`after send(): status=${observed.afterSend}`);
      console.log(`after wait(): status=${observed.afterWait} result=${JSON.stringify(observed.text ?? null)}`);
    },
  },

  "pitfall:permissions": {
    takes: "",
    needs: "none",
    note: "needs no credential",
    run: () => {
      const shapes = demonstratePermissionEngineShape();
      for (const [label, rules] of Object.entries(shapes)) {
        const kind = Array.isArray(rules) ? `an array of ${rules.length}` : typeof rules;
        console.log(`${label.padEnd(10)} form: rules is ${kind} — ${JSON.stringify(rules)}`);
      }
    },
  },

  "demo:poisoned": {
    takes: "",
    needs: "none",
    run: () => runPoisonedDemo(MODEL),
  },

  "verify:permissions": {
    takes: "[n]",
    needs: "none",
    run: (input) => {
      const n = Number.parseInt(input, 10);
      return verifyPermissions(MODEL, Number.isFinite(n) && n > 0 ? n : 6);
    },
  },
};

await runCli({
  title: "theokit memory example — an assistant that remembers between runs",
  commands: COMMANDS,
  footer:
    `Memory lives in ${PROJECT_DIR}/.theokit/memory/ — markdown files you can read and commit.\n` +
    `Set THEOKIT_MODEL to use a different provider (currently ${MODEL}).`,
});
