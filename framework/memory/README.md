> ## Documentation Index
> Fetch the complete example index at: llms.txt (this repository's root)
> Use this file to discover all available examples before exploring further.

# How a served agent remembers between requests

> Give an agent that is a file a durable memory, and choose where the store lives.

Every HTTP request rebuilds the agent from `agents/remember.ts`. Nothing survives in the process
between two of them — so if the second request knows something the first one was told, a directory
on disk is the only path it could have taken.

This is the framework half of a pair. [`sdk/memory`](../../sdk/memory/README.md) proves the same
capability between two **processes**; this one proves it between two **requests**, which is the
shape a served agent actually meets.

This page covers how to:

* [Turn memory on](#one-setting-and-where-it-points) and say where the store lives
* [Read the proof](#what-npm-test-actually-does) — a real server, a real store, no credential
* [Avoid three failures](#three-things-that-will-bite-you) — one of them leaves no trace at all
* [Know what is out of scope](#what-this-does-not-teach)

```sh
npm install
npm test          # proves it, with no credential
```

Pinned to `theokit@0.63.0`, `@theokit/agents@12.1.0` and `@theokit/sdk@4.63.0`. The SDK version is
not incidental — see below.

## One setting, and where it points

```ts
export default AgentBuilder.create()
  .input(z.object({ message: z.string() }))
  .model(process.env.LLM_MODEL ?? "openai/gpt-4o-mini")
  .memory({ enabled: true, directory: process.env.MEMORY_DIR })
  .build();
```

`.memory()` takes the SDK's `MemorySettings` **unchanged**. There is no framework-shaped wrapper
and no second vocabulary: what you would pass to `Agent.create({ memory })` is what you pass here.

`directory` is the half that used to go missing. The framework accepted a memory setting and the
durable store went somewhere else, so an app could configure a location and be quietly ignored
([theokit#557](https://github.com/usetheokit/theokit/issues/557)). It is honoured from
`@theokit/sdk@4.63.0` on, which is why this example pins that version and not an earlier one — an
earlier pin would make the central lesson of this example false.

Absolute, or starting with `~/`. A relative path is refused rather than resolved.

## What `npm test` actually does

It starts the real `theokit dev` with `LLM_MODEL` pointed at a local stub speaking Ollama's wire
protocol, and `MEMORY_DIR` at a fresh temp directory. Routing, agent compilation, the SDK, the
memory store and the streaming are all real; only the model at the far end is replaced.

**That replacement makes the proof stronger here, not weaker.** `sdk/memory` proves recall by
asking a real model a question and reading its answer — which needs a credential, and is evidence
about one sampling. The stub records every request body the SDK sent, so this suite asserts on the
**prompt** instead of on a reply.

| Assertion | What it proves |
|---|---|
| `POST /api/agents/definitely-not-an-agent` → 404 | that a 404 is reachable at all — without this, the next line proves nothing |
| `POST /api/agents/remember` → 200 | the file became the route and the agent ran |
| a memory file appears under `MEMORY_DIR` **and the SDK's default store stays empty** | `directory` moved the store, rather than adding a second one |
| the fact appears in the messages the provider received on a **later** request | recall crossed the request boundary, and could only have come off disk |

The third row asserts both halves on purpose. "A file appeared where I asked" would still pass if
the SDK also wrote to its default; what makes it a statement about `directory` is that the default
stayed empty.

## Three things that will bite you

**A relative `directory` writes nothing and tells nobody.** The store must be absolute or start
with `~/`, because *relative to what* has two plausible answers in a served app. But every guess
about where that refusal surfaces is wrong — measured, and asserted by the suite:

| where you would look | what happens |
|---|---|
| `Agent.create()` | does not throw |
| `theokit dev` | starts normally, prints its port |
| the first request | HTTP 200, an ordinary reply, no error in the stream |
| the disk | nothing at `./memory`, nothing at the SDK's default store |

The refusal is real, and it goes to the SDK's diagnostics sink, which is silent unless the host
installs one. So an app with this typo answers every request correctly and remembers nothing,
forever. An exception would be a good day — the mistake would announce itself on the first request.
This announces itself the week somebody notices the agent never learned anything.

**The agent never decides to remember.** A durable entry traces to the user's text — a message
beginning `Remember:` — never to the model judging something worth keeping. So an agent that
"will not remember" is usually an agent nobody asked to, and behind HTTP the caller building the
request body is the one holding that switch.

**The CSRF header.** `useAgent` and the typed client send `X-Theo-Action` for you. A hand-built
`fetch`, a curl or a test must send it, or the answer is `403 CSRF_FAILED` — which reads like a
broken agent and is a request that never reached one.

## What this does not teach

The React side (`useAgent`, rendering the stream), per-user stores and the owner check a real app
needs, and whether the *right* fact is recalled for a given question — this suite proves a fact
reached the prompt, not that retrieval ranked it well.

Memory poisoning and the permission layer are measured in [`sdk/memory`](../../sdk/memory/README.md),
against a real model, and are not repeated here.
