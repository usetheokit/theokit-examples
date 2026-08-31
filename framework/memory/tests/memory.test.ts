/**
 * The proof, against the real framework, with no credential.
 *
 * This starts the actual `theokit dev` — the same command a reader runs — with `LLM_MODEL` pointed
 * at `runtime/fake-provider.ts` and `MEMORY_DIR` at a fresh temp directory. Routing, agent
 * compilation, the SDK, the memory store and the streaming are all real; the only thing replaced
 * is the model at the far end.
 *
 * THAT REPLACEMENT MAKES THE PROOF STRONGER HERE, NOT WEAKER. The SDK example proves recall by
 * asking a real model a question and reading its answer — which needs a credential and is only ever
 * evidence about one sampling. The fake provider records every request body the SDK sent, so this
 * suite asserts on the PROMPT rather than on a reply: if a fact learned in request 1 appears in the
 * messages the provider received in request 2, recall crossed the request boundary. That is
 * deterministic, and no model had to cooperate.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENT_REQUEST_HEADERS, WRITE_INSTRUCTION_PREFIX } from "../agents/lib/pitfalls.js";
import { startFakeProvider, type FakeProvider } from "../runtime/fake-provider.js";

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));

let fake: FakeProvider;
let server: ChildProcess;
let origin: string;
let memoryDir: string;
let serverOutput: () => string;

/** The fact this suite plants and then looks for. Distinctive enough that a match is not chance. */
const FACT = "deploys go through the release branch, never main";

function startServer(
  model: string,
  dir: string,
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
    env: { ...process.env, LLM_MODEL: model, MEMORY_DIR: dir },
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
 * POST to an agent AND DRAIN THE REPLY.
 *
 * The draining is not tidiness. `fetch` resolves as soon as the headers arrive, and the agent runs
 * while the body is still streaming — so a test that asserts on the provider or on the store
 * immediately after the call is asking about work that has not started. The first version of this
 * suite did exactly that and read `200` with the provider never contacted, which looks like a
 * broken agent and is a test that did not wait.
 */
async function post(path: string, body: unknown): Promise<{ status: number; text: string }> {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { ...AGENT_REQUEST_HEADERS },
    body: JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
}

/**
 * Wait for the store to hold at least one memory file.
 *
 * Polled rather than asserted once, because the durable write finishes inside the run and the
 * response returns when the stream ends — two events with no ordering guarantee between them. A
 * bare assertion would be a race that passes on a fast machine and fails in CI, which is a flaky
 * test, which is a bug (`rules/testing.md` § 3).
 */
async function memoryFiles(timeoutMs = 20_000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = (await readdir(memoryDir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));
    if (found.length > 0) return found;
    if (Date.now() > deadline) return [];
    await new Promise((r) => setTimeout(r, 250));
  }
}

before(async () => {
  memoryDir = await mkdtemp(join(tmpdir(), "theokit-framework-memory-"));
  fake = await startFakeProvider({ provider: "ollama", reply: "Noted." });
  const started = await startServer(fake.model, memoryDir);
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
  await rm(memoryDir, { recursive: true, force: true });
});

/**
 * The control. "The agent answered" proves nothing on its own — a server that answers everything
 * would pass it. It is the pair that proves the file created the route.
 */
test("lesson core-memory-on-an-agent-file: an unknown agent is a 404", async () => {
  const response = await post("/api/agents/definitely-not-an-agent", { message: "hello" });
  assert.equal(response.status, 404);
});

test("lesson core-memory-on-an-agent-file: the file is the route, and the agent runs", async () => {
  // Reaching the agent at all also exercises `lesson setup-agent-policy`: `policy = "public"` is
  // what lets an unauthenticated caller run it. Any other policy would refuse before the run — and
  // with memory on, what a public policy exposes is the store, not just one reply.
  const response = await post("/api/agents/remember", { message: "hello" });
  assert.equal(response.status, 200, response.text);
  assert.ok(fake.requests.length > 0, "the SDK reached the provider");
});

/**
 * The lesson this pair exists for. The framework forwards `directory` to the SDK, so the store is
 * where the app said — and demonstrably NOT at the default the SDK would have picked.
 *
 * Both halves are asserted. "A file appeared in MEMORY_DIR" alone would still pass if the SDK also
 * wrote to its default; what makes this a statement about `directory` is that the default location
 * stayed empty.
 */
test("lesson core-memory-on-an-agent-file: a durable memory lands in the directory the app declared", async () => {
  const response = await post("/api/agents/remember", { message: `${WRITE_INSTRUCTION_PREFIX} ${FACT}` });
  assert.equal(response.status, 200, response.text);

  const written = await memoryFiles();
  assert.ok(written.length > 0, `no memory file under ${memoryDir}`);

  const body = await readFile(join(memoryDir, written[0]!), "utf8");
  assert.match(body, /release branch/, "the file holds the fact, not just a name");

  const defaultStore = await readdir(join(projectDir, ".theokit", "memory")).catch(() => [] as string[]);
  assert.deepEqual(
    defaultStore.filter((f) => f.endsWith(".md")),
    [],
    "the default store must stay empty — otherwise `directory` moved nothing",
  );
});

/**
 * Recall across the request boundary, asserted on the prompt rather than on a reply.
 *
 * Every request rebuilds the agent from `agents/remember.ts`; nothing is held in process memory
 * between the two. So a fact from the earlier request appearing in this one's messages can only
 * have come off disk.
 */
test("lesson core-memory-on-an-agent-file: a fact learned in one request reaches the prompt of the next", async () => {
  const before = fake.requests.length;
  const response = await post("/api/agents/remember", { message: "which branch do deploys go through?" });
  assert.equal(response.status, 200, response.text);

  const sent = fake.requests.slice(before);
  assert.ok(sent.length > 0, "the second request reached the provider");

  const prompt = JSON.stringify(sent.map((r) => r.messages ?? []));
  assert.match(prompt, /release branch/, "the recalled fact was not in the prompt the provider saw");
});

/**
 * The write switch is the USER'S text, not the agent's judgement. An ordinary message must leave
 * the store untouched — otherwise the earlier assertion proves only that files appear, not that an
 * instruction is what makes one.
 */
test("lesson pitfall-writes-need-an-instruction: an ordinary message writes nothing", async () => {
  const before = (await readdir(memoryDir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));

  const response = await post("/api/agents/remember", { message: "what time is it?" });
  assert.equal(response.status, 200, response.text);

  const after = (await readdir(memoryDir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));
  assert.deepEqual(after, before, "a message with no instruction must not create a memory");
});

/**
 * A state-changing route is CSRF-protected by default, and nobody switched that on.
 */
test("lesson pitfall-csrf-header: a request without the header never reaches the agent", async () => {
  const response = await fetch(`${origin}/api/agents/remember`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "no header" }),
  });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /CSRF/i);
});

/**
 * The pitfall this example exists to make visible — and it is worse than an error.
 *
 * Its own server, because the setting is read when the agent is built at start-up. The assertions
 * are about where the failure is NOT: not at boot, not in the status code, not in the stream, and
 * not on disk. It is nowhere the caller can see.
 */
test("lesson pitfall-relative-directory: it writes nothing and says nothing", async () => {
  const started = await startServer(fake.model, "./memory");
  try {
    const response = await fetch(`${started.origin}/api/agents/remember`, {
      method: "POST",
      headers: { ...AGENT_REQUEST_HEADERS },
      body: JSON.stringify({ message: `${WRITE_INSTRUCTION_PREFIX} this is never stored` }),
    });

    // The server booted and the route answers normally. The bad value colours neither.
    assert.equal(response.status, 200, "a misconfigured store does not colour the status code");
    const stream = await response.text();
    assert.doesNotMatch(stream, /"type":"error"/, "and it does not surface as an error either");

    // And nothing was written — not at the relative path, not at the SDK's default.
    const relative = (await readdir(join(projectDir, "memory")).catch(() => [] as string[]))
      .filter((f) => f.endsWith(".md"));
    const fallback = (await readdir(join(projectDir, ".theokit", "memory")).catch(() => [] as string[]))
      .filter((f) => f.endsWith(".md"));
    assert.deepEqual([...relative, ...fallback], [], "a relative directory must not silently store");
  } finally {
    if (started.child.pid !== undefined) {
      try {
        process.kill(-started.child.pid, "SIGTERM");
      } catch {
        started.child.kill("SIGTERM");
      }
    }
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
