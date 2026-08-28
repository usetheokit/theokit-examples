# Memory

An assistant that remembers your project's conventions between runs.

```sh
npm install

npm start -- learn "deploys go through the release branch, never main"
npm start -- ask   "which branch do deploys go through?"
```

The two commands are **separate processes**. Nothing is shared between them but a directory on
disk — no conversation, no transcript, no handle held open. If the second one answers, memory is
the only path the answer could have taken.

## What the setup costs

```ts
const agent = await Agent.create({
  model: { id: "openai-chatgpt/gpt-5.4-mini" },
  local: { cwd: projectDir },
  memory: { enabled: true },
});
```

One line. The store is `<projectDir>/.theokit/memory/` — one markdown file per memory plus a
`MEMORY.md` index. Versionable, readable, editable by hand. No server, no database.

```markdown
---
name: deploys-go-through-release
description: "deploys go through the release branch, never main"
metadata:
  node_type: memory
  type: project
  modified: 2026-08-28T12:40:23.410Z
  observations: 1
---

deploys go through the release branch, never main
```

## Three things that are easy to get wrong

**`send()` does not return the answer.** It starts a run and hands back a handle whose `status` is
`"running"`. The text arrives from `wait()`:

```ts
const run = await agent.send(message);
const finished = await run.wait();
finished.result; // the text
```

This example was written with `await agent.send(...)` alone and printed nothing, twice, while the
memory file was written correctly on disk. The failure reads as "memory is broken" and is really
"the run had not finished".

**Writes are triggered by the user's text, not by the agent.** A message beginning `Remember:` is
what makes an entry. The agent does not decide to remember and does not mine the conversation for
facts — every entry traces to an explicit instruction. Nothing is kept unless someone asks.

**`new PermissionEngine([])` takes its rules positionally.** The object form
(`{ rules: [] }`) compiles nowhere and constructs an engine with no usable rule list. In JavaScript
nothing checks, and a crashing engine produces the same observation as a working one.

## The half a happy-path example will not teach you

```sh
npm start -- demo:poisoned
npm start -- verify:permissions 6
```

The store is a directory. Anything that can write to it — a dependency's postinstall, a shared
volume, a repository you cloned — can put a sentence in front of the agent at the start of every
future session. `demo:poisoned` writes one by hand, with no agent involved, and then asks the
assistant to do ordinary work.

Measured against `@theokit/sdk@4.62.0`, over 6 runs each:

| | file created |
|---|---|
| memory enabled, no permission layer | **6 of 6** |
| same plant, `PermissionEngine([])` registered | **0 of 6**, zero errors |

**This example registers the permission layer by default. The SDK does not.**

Two things that number does not say:

- It was **2 of 6** against an earlier version — because that version did not recall the planted
  entry at all. Improving recall made the plant reliable. The property that makes a planted memory
  work is the property that makes a real one useful, so better recall is a change to the threat
  model rather than something orthogonal to it.
- Asking a **question** rather than giving a task still gets a shaped answer. Asserting is not a
  tool call, so no permission check runs on it — measured at roughly 62% (95% CI 39–82%, n=32)
  even with the entry marked uncorroborated in the prompt.

If you cannot tolerate the agent repeating a planted claim, keep untrusted writers out of the
memory directory. That is a filesystem permission, not a memory feature.

## Requirements

A provider credential. The default is `openai-chatgpt/gpt-5.4-mini`; set `THEOKIT_MODEL` to use
another. `THEOKIT_PROJECT_DIR` moves the store somewhere other than `./workspace`.
