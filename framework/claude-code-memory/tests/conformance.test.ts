/**
 * Does a SERVED agent write a store the Claude Code CLI can classify?
 *
 * The layout question is answered by `sdk/claude-code-memory`, against a recording of a real CLI
 * session. This is the half that side cannot ask: the store here is produced by a real `theokit dev`
 * server running a real agent over HTTP, and what it proves is that the trip through the framework
 * changes nothing about the shape — and that one property is decided by the CALLER, not the layer.
 *
 * No credential: `LLM_MODEL` points at `runtime/fake-provider.ts`, which speaks the wire protocol
 * and consults no model. The memory write happens in the SDK either way, so a stub at the far end
 * removes nothing this suite asserts.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENT_REQUEST_HEADERS, classificationOf, KINDS } from "../agents/lib/classification.js";
import { startFakeProvider, type FakeProvider } from "../runtime/fake-provider.js";

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));

let fake: FakeProvider;
let server: ChildProcess;
let origin: string;
let memoryDir: string;
let serverOutput: () => string;

/** The fact this suite plants and then looks for. Distinctive enough that a match is not chance. */
const FACT = "the served path pins vitest at 1.2.3";

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


/**
 * Stop the server AND everything it started. `detached: true` makes the child a group leader, so a
 * negative pid signals the whole group — signalling the child alone leaves a survivor holding this
 * runner's stdio open, which is a suite that passes every assertion and then hangs until a timeout.
 */
async function stopServer(): Promise<void> {
  if (server?.pid === undefined) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

before(async () => {
  memoryDir = await mkdtemp(join(tmpdir(), "claude-code-conformance-"));
  fake = await startFakeProvider({ provider: "ollama", reply: "Noted." });
  const started = await startServer(fake.model, memoryDir);
  server = started.child;
  origin = started.origin;
  serverOutput = started.output;
});

after(async () => {
  await stopServer();
  await fake?.close();
  await rm(memoryDir, { recursive: true, force: true });
});

/** Wait for the store to hold a memory file — the durable write and the response end are unordered. */
async function storedFiles(timeoutMs = 20_000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = (await readdir(memoryDir).catch(() => [] as string[]))
      .filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
    if (found.length > 0) return found;
    if (Date.now() > deadline) return [];
    await new Promise((r) => setTimeout(r, 250));
  }
}

test("lesson core-a-served-agent-writes-the-same-store: the file and the index appear", async () => {
  const response = await post("/api/agents/remember", { message: `Remember (project): ${FACT}` });
  assert.equal(response.status, 200, response.text);

  const files = await storedFiles();
  assert.equal(files.length, 1, "one memory, written through the server");

  const index = await readFile(join(memoryDir, "MEMORY.md"), "utf8");
  assert.match(index, /^- \[[^\]]+\]\([^)]+\.md\)/m, "the index entry has the CLI's shape");
});

/**
 * The property this example exists for. Same agent, same server, two message forms — and only one
 * of them produces a memory the Claude Code CLI could categorise.
 */
test("lesson core-the-kind-comes-from-the-callers-text: the type follows the message, not the layer", async () => {
  const declared = (await storedFiles())[0];
  assert.ok(declared, "the earlier `Remember (project):` was stored");
  const typed = classificationOf(await readFile(join(memoryDir, declared), "utf8"));
  assert.ok(KINDS.includes(typed as never), `a declared kind produces metadata.type (got ${typed})`);

  const bare = await post("/api/agents/remember", { message: "Remember: a fact with no kind" });
  assert.equal(bare.status, 200, bare.text);

  const after = (await storedFiles()).filter((f) => f !== declared);
  assert.equal(after.length, 1, "the bare form is stored too — it is not rejected");
  const untyped = classificationOf(await readFile(join(memoryDir, after[0] ?? ""), "utf8"));
  assert.equal(untyped, undefined, "and it carries no metadata.type at all");
});

/**
 * Both forms produce a valid store. The difference is not validity — it is whether a reader that
 * groups by kind, as the CLI does, can see this memory at all.
 */
test("lesson pitfall-csrf-header: a request without the header never reaches the agent", async () => {
  const response = await fetch(`${origin}/api/agents/remember`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Remember (project): no header" }),
  });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /CSRF/i);
});

test("lesson setup-agent-policy: the boot refuses nothing, because the agent declares its policy", () => {
  const boot = serverOutput();
  assert.ok(boot.length > 0, "no boot output was captured — the assertion below would prove nothing");
  for (const pattern of [/undeclared/i, /\brefus(e|ed|ing)\b/i, /\bdenied\b/i]) {
    assert.doesNotMatch(boot, pattern, `the boot said something matching ${pattern}`);
  }
});
