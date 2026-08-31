> ## Documentation Index
> Fetch the complete example index at: llms.txt (this repository's root)
> Use this file to discover all available examples before exploring further.

# How an agent remembers your project

> Give an agent durable memory with one setting, and learn what a directory of markdown on disk can and cannot promise.

Two separate runs of a program share nothing — no conversation, no transcript, no handle held
open. Memory is what carries a fact from the first to the second, and here it is a directory you
can read, diff and delete.

This page covers how to:

* [Turn memory on](#what-the-setup-costs) and see the files it writes
* [Avoid three mistakes](#three-things-that-are-easy-to-get-wrong) that read as "memory is broken" and are not
* [Understand what a writable store lets in](#the-half-a-happy-path-example-will-not-teach-you), measured rather than asserted
* [Run it](#requirements) against your own provider

```sh
npm install

npm start -- learn "deploys go through the release branch, never main"
npm start -- ask   "which branch do deploys go through?"
```

The two commands are **separate processes**. Nothing is shared between them but a directory on
disk. If the second one answers, memory is the only path the answer could have taken.

## What the setup costs

```ts
const agent = await Agent.create({
  model: { id: "ollama/llama3.2" },
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

**`new PermissionEngine([])` takes its rules positionally.** The object form (`{ rules: [] }`)
compiles nowhere — and, measured against `@theokit/sdk` 4.61.0, does not throw either. It stores
the whole options object in the field meant to hold the array, so no rule can ever match: a silent
no-op wearing the shape of a configured gate. `npm start -- pitfall:permissions` prints both.
In JavaScript nothing checks, and an inert engine produces the same observation as a working one.

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

**No API key.** The default is the repository's shared local server — `ollama/llama3.2` on
`localhost:11434`:

```sh
ollama serve
ollama pull llama3.2
```

`THEOKIT_MODEL` points anywhere else; `THEOKIT_PROJECT_DIR` moves the store off `./workspace`.

**What a 3B model proves, and what it does not.** The write is deterministic — the markdown file
appears every time. The *answer* is not: measured over five runs against the same store,
`llama3.2` used the stored fact 4 times and declined once, saying it did not have the information.
It did. A run that lands on that fifth case is the model refusing a fact that is on disk, not a
memory that failed — and the file is right there to check. A hosted model removes the variance.
