/**
 * The proof that this example works, run against a real agent with no credential.
 *
 * Every lesson `skill.json` declares has a test here. That is the point: a lesson is code the
 * generator copies verbatim into a skill, so a lesson nobody executes is a claim, and this
 * repository publishes claims to agents that cannot check them.
 *
 * The provider is `runtime/fake-provider.ts` — a local server speaking the chat-completions
 * protocol. So the SDK really resolves a provider, opens a transport, streams and parses; what it
 * does NOT do is consult a model. These tests prove the plumbing and the memory store. They prove
 * nothing about the quality of an answer, because there is no model behind the answer.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startFakeProvider } from "../runtime/fake-provider.js";
import { ask, createAssistant } from "../src/memory.js";
import { recall, remember } from "../src/minimal.js";
import {
  demonstratePermissionEngineShape,
  demonstrateSendReturnsHandle,
} from "../src/pitfalls.js";

/** A store per test: memory is a directory, and a shared one would couple the tests through disk. */
const freshProject = () => mkdtemp(join(tmpdir(), "theokit-example-memory-"));

test("lesson core-ask-and-wait: the answer comes back, and the question reached the provider", async () => {
  const projectDir = await freshProject();
  const fake = await startFakeProvider({ reply: "the release branch" });

  try {
    const agent = await createAssistant({ projectDir, model: fake.model });
    const answer = await ask(agent, "which branch do deploys go through?");

    assert.equal(answer, "the release branch");
    assert.equal(fake.requests.length, 1);
    assert.match(
      JSON.stringify(fake.requests[0]?.messages ?? []),
      /which branch do deploys go through\?/,
    );
  } finally {
    await fake.close();
  }
});

test("lesson core-create-agent-with-memory: one option creates the store on disk", async () => {
  const projectDir = await freshProject();
  const fake = await startFakeProvider({ reply: "noted" });

  try {
    const agent = await createAssistant({ projectDir, model: fake.model });
    await ask(agent, "Remember (project): the deploy runbook lives in docs/deploy.md");

    // `memory: { enabled: true }` is the whole setup, and this is its observable effect.
    assert.ok((await readdir(join(projectDir, ".theokit", "memory"))).length > 0);

    // The lesson also says the permission layer is registered by default, and this asserts that it
    // reaches the agent's configuration — NOT that it blocks anything. Whether the layer is
    // effective is measured by `npm start -- demo:poisoned`, which needs a real model; asserting
    // protection from a configuration field would be claiming more than was measured.
    //
    // Do not read `agent.pluginsManager` looking for it: `AgentOptions.plugins` takes two mutually
    // exclusive forms, and that manager only holds one of them. `{ enabled: [...] }` selects
    // FILE-DISCOVERED plugins under `.theokit/plugins/`; an array of `Plugin` objects — what this
    // example passes — is registered directly by the runtime through `extractCodePlugins` and never
    // appears there. An empty `pluginsManager.plugins` alongside a populated `options.plugins` is
    // the normal shape, not a symptom.
    const configured = (agent as unknown as { options?: { plugins?: ReadonlyArray<{ name: string }> } }).options;
    assert.deepEqual(
      configured?.plugins?.map((plugin) => plugin.name),
      ["permission-engine"],
    );
  } finally {
    await fake.close();
  }
});

test("lesson minimal: learning writes a markdown file a human can read", async () => {
  const projectDir = await freshProject();
  const fake = await startFakeProvider({ reply: "noted" });

  try {
    await remember(projectDir, fake.model, "deploys go through the release branch, never main");

    const store = join(projectDir, ".theokit", "memory");
    const entries = await readdir(store);
    assert.ok(entries.includes("MEMORY.md"), `expected a MEMORY.md index, found ${entries.join(", ")}`);

    const written = entries.find((name) => name.endsWith(".md") && name !== "MEMORY.md");
    assert.ok(written !== undefined, `expected a memory file, found ${entries.join(", ")}`);
    assert.match(await readFile(join(store, written), "utf8"), /release branch/);
  } finally {
    await fake.close();
  }
});

test("the whole point: a fresh agent is handed what a previous one learned", async () => {
  const projectDir = await freshProject();
  const fake = await startFakeProvider({ reply: "noted" });

  try {
    // First agent learns. Second agent is a separate instance that shares only the directory.
    await remember(projectDir, fake.model, "deploys go through the release branch, never main");
    await recall(projectDir, fake.model, "which branch do deploys go through?");

    assert.equal(fake.requests.length, 2, "expected one request per agent");
    const second = JSON.stringify(fake.requests[1]?.messages ?? []);
    assert.match(second, /release branch/, "the second agent was not given the first one's memory");
  } finally {
    await fake.close();
  }
});

test("lesson pitfall-send-returns-handle: send() hands back a run that has not finished", async () => {
  const projectDir = await freshProject();
  const fake = await startFakeProvider({ reply: "done" });

  try {
    const agent = await createAssistant({ projectDir, model: fake.model });
    const observed = await demonstrateSendReturnsHandle(agent, "anything");

    assert.equal(observed.afterSend, "running", "send() should return a handle that is still running");
    assert.equal(observed.afterWait, "finished");
    assert.equal(observed.text, "done", "the text only exists after wait()");
  } finally {
    await fake.close();
  }
});

test("lesson pitfall-permission-engine-shape: the object form silently loses the rule list", () => {
  const { positional, objectForm } = demonstratePermissionEngineShape();

  assert.ok(Array.isArray(positional), "the positional form must produce a usable rule array");
  assert.equal(positional.length, 1);

  assert.ok(!Array.isArray(objectForm), "the object form is the pitfall: it does not throw");
  assert.deepEqual(objectForm, { rules: [{ tool: "shell", action: "deny" }] });
});
