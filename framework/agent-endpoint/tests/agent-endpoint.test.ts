/**
 * The proof, against the real framework, with no credential.
 *
 * This starts the actual dev server — the same `theokit dev` a reader runs — with `LLM_MODEL`
 * pointed at `runtime/fake-provider.ts`. So the routing, the agent compilation, the SDK, the
 * transport and the streaming are all real; the only thing replaced is the model at the far end.
 *
 * Which makes the 404 assertion load-bearing rather than decorative. "The agent answered" proves
 * nothing on its own — a server that answers everything would pass it. It is the pair that proves
 * the claim: an unknown agent is 404, and this one is 200, so the file is what created the route.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { AGENT_REQUEST_HEADERS } from "../agents/lib/pitfalls.js";
import { startFakeProvider, type FakeProvider } from "../runtime/fake-provider.js";

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** The provider the framework registers by name, and the one it only reaches once declared. */
let fake: FakeProvider;
let declared: FakeProvider;
let server: ChildProcess;
let origin: string;
let serverOutput: () => string;

/**
 * Start `theokit dev` and resolve once it prints the port it settled on.
 *
 * The port is read from the output rather than fixed, because the dev server takes the next free
 * one when 3000 is busy — and a test that assumed 3000 would pass or fail depending on what else
 * the machine happens to be running.
 */
function startServer(
  model: string,
): Promise<{ child: ChildProcess; origin: string; output: () => string }> {
  // The binary DIRECTLY, not through `npx`, and in its own process group.
  //
  // `spawn("npx", ["theokit", "dev"])` makes npx the child this test can signal and the server its
  // GRANDchild. `child.kill()` then SIGTERMs npx, npx exits without forwarding, and the server
  // survives holding this runner's stdio open — so the suite passes every assertion and then never
  // exits. Measured: an orphaned `node .../node_modules/.bin/theokit dev` still alive after
  // `after()` had run, and three runs killed by their own timeout with every `ok` already printed.
  //
  // That failure reads exactly like a hung server. It is not the framework refusing to stop; it is
  // a signal that never reached it.
  const child = spawn(join(projectDir, "node_modules", ".bin", "theokit"), ["dev"], {
    detached: true,
    cwd: projectDir,
    // No credential of any kind. A keyless provider — `authType: "none"` in the SDK's catalog —
    // must reach its endpoint with nothing set; theokit#585 was the release where that became true.
    env: { ...process.env, LLM_MODEL: model },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Everything the server says, kept — not just the line carrying the port.
  //
  // The first version read the output only until it matched a port and let the rest fall on the
  // floor. That made the suite structurally unable to notice anything the boot printed: a warning
  // could be emitted on every run and every test would still pass. A harness that cannot observe a
  // class of failure is a harness that reports its absence.
  let transcript = "";

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("theokit dev did not report a port in 120s")), 120_000);
    const onOutput = (buffer: Buffer) => {
      transcript += String(buffer);
      const found = /localhost:(\d+)/.exec(String(buffer));
      if (found === null) return;
      clearTimeout(timer);
      resolve({ child, origin: `http://localhost:${found[1]}`, output: () => transcript });
    };
    child.stdout?.on("data", onOutput);
    child.stderr?.on("data", onOutput);
  });
}

/**
 * `X-Theo-Action` is not ceremony. Without it the framework answers
 * `CSRF_FAILED: Missing X-Theo-Action header` — a state-changing endpoint is CSRF-protected by
 * default, and nobody had to switch that on. The typed client sends it; a raw `fetch` must.
 */
const post = (path: string, body: unknown) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { ...AGENT_REQUEST_HEADERS },
    body: JSON.stringify(body),
  });

before(async () => {
  fake = await startFakeProvider({ provider: "ollama", reply: "one short sentence." });
  // `lmstudio` is in the SDK's catalog of 45 and not in the registry the framework consults, so it
  // is exactly the prefix that separates "declared" from "refused".
  declared = await startFakeProvider({ provider: "lmstudio", reply: "one short sentence." });
  const started = await startServer(fake.model);
  server = started.child;
  origin = started.origin;
  serverOutput = started.output;
});

/**
 * Stop the server AND everything it started.
 *
 * `spawn(..., { detached: true })` makes the child a process-group leader, so a negative pid signals
 * the whole group. Signalling the child alone leaves anything it forked behind, and a survivor holds
 * this runner's stdio open — which is the difference between a suite that exits and one that passes
 * every assertion and then hangs until a timeout kills it.
 */
async function stopServer(): Promise<void> {
  if (server?.pid === undefined) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // Already gone, or never became a group leader. Either way there is nothing left to signal.
    server.kill("SIGTERM");
  }
}

after(async () => {
  await stopServer();
  await fake?.close();
  await declared?.close();
});

test("lesson core-agent-as-a-file: the file's path is the route, and nothing registered it", async () => {
  // Reaching the agent at all also exercises `lesson setup-agent-policy`: `policy = "public"` is
  // what lets an unauthenticated caller run it. Any other policy would refuse before the run.
  const unknown = await post("/api/agents/definitely-not-an-agent", { message: "x" });
  assert.equal(unknown.status, 404, "an unnamed agent must 404, or the next assertion proves nothing");

  const response = await post("/api/agents/chat", { message: "prove it" });
  assert.equal(response.status, 200);

  const stream = await response.text();
  assert.match(stream, /one short sentence\./, "the reply the provider gave did not reach the caller");
  assert.equal(fake.requests.length, 1, "the agent run never reached the provider");
});

test("lesson core-agent-as-a-file: the declared input schema is enforced at the boundary", async () => {
  const response = await post("/api/agents/chat", { wrong: "shape" });

  assert.notEqual(response.status, 200, "a body that does not match `.input()` must be refused");
  assert.equal(fake.requests.length, 1, "the agent must not run on input it did not declare");
});

test("lesson pitfall-csrf-header: a state-changing route is CSRF-protected without asking", async () => {
  const response = await fetch(`${origin}/api/agents/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "no header" }),
  });

  assert.equal(response.status, 403);
  assert.match(await response.text(), /CSRF/i);
});

test("lesson variant-declared-provider: declaring the catalog is what makes a prefix routable", async () => {
  // The second agent declares `.plugins(Provider.builtins())` and asks for `lmstudio/…`, which
  // `chat.ts` cannot reach. Same server, same request shape, one line of difference in the file.
  const response = await post("/api/agents/declared-provider", { message: "prove it" });
  const body = await response.text();

  assert.equal(response.status, 200, body);
  assert.match(body, /one short sentence\./);
  assert.equal(declared.requests.length, 1, "the declared provider never reached its stub");
});

test("lesson pitfall-provider-registry: an undeclared provider prefix is refused", async () => {
  // The SDK's catalog has 43 providers; `@theokit/agents` keeps its own, much smaller registry, and
  // refuses an unknown prefix before any request leaves the process. Measured here rather than
  // asserted, because the readable failure is the whole value of the lesson.
  const rogue = await startServer("lmstudio/lmstudio-community/default");
  try {
    const response = await fetch(`${rogue.origin}/api/agents/chat`, {
      method: "POST",
      headers: { ...AGENT_REQUEST_HEADERS },
      body: JSON.stringify({ message: "x" }),
    });

    assert.match(await response.text(), /not registered/i);
  } finally {
    rogue.child.kill("SIGTERM");
  }
});

/**
 * The boot says nothing about these routes — which is the claim, not the wish.
 *
 * `theokit@0.64` makes `undeclaredRoutes` refuse by default and gives agent entries a named refusal
 * at boot. The framework maintainer measured that the gate governs a DIFFERENT surface — entries
 * passed to `TheoApp.create`, not files under `agents/` served by `mountAgent` — and that the boot
 * notice is emitted only for the former. These examples are the latter.
 *
 * That is their claim about their code. This is the only place it can be falsified from outside, so
 * it is asserted here rather than believed: every agent file in this example declares
 * `export const policy`, and the boot must stay silent about all of them.
 *
 * HONEST LIMIT: it matches TEXT. A notice worded outside these patterns escapes it, and a green
 * here means "nothing matching was printed", never "nothing was printed". What it does catch is the
 * shape described above, on the day a pin bump makes it reachable.
 */
test("lesson setup-agent-policy: the boot refuses nothing, because every agent declares its policy", () => {
  const boot = serverOutput();

  // Without this line the assertions below pass over an empty string, which is a green about
  // nothing. The boot output must have been captured before its content can mean anything.
  assert.ok(boot.length > 0, "no boot output was captured — the assertions below would prove nothing");

  for (const pattern of [/undeclared/i, /\brefus(e|ed|ing)\b/i, /\bdenied\b/i, /not declared/i]) {
    assert.doesNotMatch(
      boot,
      pattern,
      `the boot said something matching ${pattern} — an agent declaring \`policy\` must not be refused`,
    );
  }
});
