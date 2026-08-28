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
 */

import { resolve } from "node:path";

import { ask, createAssistant } from "./assistant.js";
import { runPoisonedDemo } from "./poisoned-demo.js";
import { verifyPermissions } from "./verify-permissions.js";

const MODEL = process.env.THEOKIT_MODEL ?? "openai-chatgpt/gpt-5.4-mini";
/** The project this assistant remembers things about. Its own directory keeps the store visible. */
const PROJECT_DIR = resolve(process.env.THEOKIT_PROJECT_DIR ?? "./workspace");

const USAGE = `
theokit memory example — an assistant that remembers between runs

  npm start -- learn "<something about your project>"
  npm start -- ask   "<a question>"
  npm start -- demo:poisoned
  npm start -- verify:permissions [n]

Memory lives in ${PROJECT_DIR}/.theokit/memory/ — markdown files you can read and commit.
Set THEOKIT_MODEL to use a different provider (currently ${MODEL}).
`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const message = rest.join(" ").trim();

  if (command === undefined || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  if (command === "demo:poisoned") {
    await runPoisonedDemo(MODEL);
    return;
  }

  if (command === "verify:permissions") {
    const n = Number.parseInt(rest[0] ?? "6", 10);
    await verifyPermissions(MODEL, Number.isFinite(n) && n > 0 ? n : 6);
    return;
  }

  if (command !== "learn" && command !== "ask") {
    console.error(`unknown command: ${command}`);
    console.log(USAGE);
    process.exitCode = 2;
    return;
  }

  if (message.length === 0) {
    console.error(`${command} needs something to say`);
    process.exitCode = 2;
    return;
  }

  const agent = await createAssistant({ projectDir: PROJECT_DIR, model: MODEL });

  // "Remember:" is what makes a write happen. The agent does not decide to remember on its own and
  // does not mine the conversation for facts — every entry traces to an explicit instruction. That
  // is a design decision with a cost worth knowing: nothing is kept unless someone asks.
  const prompt = command === "learn" ? `Remember (project): ${message}` : message;

  console.log(await ask(agent, prompt));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nfailed: ${message}`);
  console.error("\nIf this looks like an auth failure, see the README: this example needs a provider credential.");
  process.exitCode = 1;
});
