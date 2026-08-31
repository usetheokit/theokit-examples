# theokit examples

Runnable examples for the theokit ecosystem. One directory per documented capability.

**Every example installs theokit from npm, at a pinned version, exactly as a stranger would.**
None of them link to a local checkout. That is the point: an example that resolves through a
workspace tests the repository it lives in, not the experience of the person who typed
`npm install`. This repository is deliberately outside the SDK so that it cannot cheat.

The cost of standing outside is that an example can rot without the SDK's CI noticing. CI here
answers part of that: each example is installed fresh from the registry and **typechecked**
against it, on every push and weekly, so an API that moved surfaces as a red build rather than as
a wasted afternoon for a reader.

Typechecked **and run**. Running used to need a provider credential, and a scheduled job that
depends on a secret is a job that stops silently when the secret rotates — so this repository proved
the weaker thing. It no longer has to: three of the SDK's providers declare `authType: "none"` on a
`localhost` baseUrl, so `_driver/fake-provider.ts` serves that protocol and a real agent run fits
inside `npm test`, with no secret anywhere. The SDK resolves the provider, opens the transport,
streams and parses; what it does not do is consult a model, so these tests prove plumbing and never
prove an answer.

Every lesson an example declares must be named by a test — the `proof` rule fails the check
otherwise. The contract checker is not in CI yet: it lives in a sibling repository, so it stays a
local gate until that changes.

## One model server, shared by every example

Every example defaults to `ollama/llama3.2` on `localhost:11434`. Ollama is a system daemon, so it
is **one server for the whole repository** — no example starts one, and nothing is configured per
example.

```sh
ollama serve          # once, in the background
ollama pull llama3.2  # ~2 GB, once
```

That is the whole setup, and it is why an example now runs **with no API key**. The model id is the
one the SDK's own catalog names for this provider, so what an example asks for and what the SDK
expects cannot drift apart.

**What a 3B model can and cannot prove.** Recall is real but not certain at this size. Measured on
`sdk/memory`, same store, same question, five runs each: `llama3.2` answered from the stored fact
**4 of 5** times, `qwen2.5:3b` 3 of 5. The write is deterministic — the file appears every time —
and it is the *answer* that varies. So a run that says "I don't have that information" is the model
declining to use a fact that IS on disk, not a memory that failed.

Point `THEOKIT_MODEL` (SDK examples) or `LLM_MODEL` (framework examples) at a hosted model with your
own credential and that variance goes away. The local default buys a reader a first run with no
signup; it does not buy the reliability of a frontier model.

**The tests do not use it — and cannot run beside it.** `npm test` runs against
`_driver/fake-provider.ts`, which speaks the wire protocol and consults no model. That is
deliberate: a suite whose verdict depends on a model's answer goes red for reasons nobody changed.
The local server is for the DEMO; the fake provider is for the PROOF.

They collide on one port, and the collision is structural rather than an oversight. `baseUrl` is a
property of the provider PROFILE in the SDK's catalog, not of a model selection, so impersonating
`ollama` means owning `11434` — the fake has nowhere else to be. And it must be `ollama`: the
framework routes only four providers, and `ollama` is the only credential-free one among them,
which is the `pitfall-provider-registry` lesson in `framework/agent-endpoint`. Moving the fake to
`lmstudio` would delete that lesson to make a test convenient.

So on one machine:

```sh
ollama serve     # demo:  npm start
ollama stop …    # proof: npm test
```

The suite says so itself when the port is taken, naming the daemon and the fix, rather than failing
as a bare `EADDRINUSE` from inside a helper.

## How to run one

```sh
cd sdk/memory
npm install
npm start
```

Each example states which credentials it needs.

## Run this before cutting a release

```sh
cd framework/agent-endpoint && npm test        # ~40s, no credential, no network
```

It starts the real `theokit dev` and drives it over HTTP against local stubs. A green suite in the
framework's own repository proves the code compiles and its tests pass; **this proves that what the
examples teach is still true**, which is a different claim and the one that rots silently.

Two limits, so nobody reads more into a green run than it carries:

- **An example pins an exact version**, so it does not see a release until someone bumps the pin.
  Bump, then run — that is the sequence that caught `theokit#585`.
- **A failure here is usually a lesson that rotted, not a broken release.** The remedy is normally
  in this repository, not in the framework's.

Written down rather than agreed between people, because an arrangement that lives in someone's head
is a step that stops happening the first week nobody remembers it.

## These examples are the source of the agent skills

An example here is not only documentation. [`@theokit/skills`](https://github.com/usetheokit/theokit-skills)
generates agent skills from this repository by **copying marked lessons of the source verbatim** —
so a skill can never teach code that does not run, because the code in the skill is the code CI
executed.

That has one consequence worth knowing before you write an example: **everything inside a lesson is
copied, comments included.** The doc comments in `sdk/memory/src/memory.ts` recording
that `agent.send()` returns a handle rather than a result, and that `PermissionEngine` takes its
rules positionally so the object form builds an engine with no usable rule list, are not asides —
they are the most valuable prose in this repository, and the generator carries them rather than
restating them. Write the pitfall where it bit you.

Two artifacts make an example extractable: a `skill.json` manifest, and `#region lesson:<id>` markers
around the code that teaches. Both are specified in **[EXAMPLE-CONTRACT.md](EXAMPLE-CONTRACT.md)**,
along with the 19 rules the checker enforces, each documented under the name its failure message
prints.

Every example outside the `framework` category has the same three fixed files under `src/` — a
driver that opens no lesson, `minimal.ts` for the smallest thing that works, and `pitfalls.ts` for
the mistakes — plus at least one domain file, and the shared command runner in `runtime/`, outside
`src/` so it stays out of the generated skill. `npm run new -- <category>/<slug>` writes the tree; `npm run sync` pushes a
runner fix into every example, and `driver-drift` fails the check when one is behind. Lesson ids carry their role in the prefix (`minimal`, `setup-*`,
`core-*`, `variant-*`, `pitfall-*`, `verify-*`), so an agent reading its second example already
knows the layout and can spend its attention on the domain.

```sh
npm run check
```

Reports every way each example departs from the contract, in one run. It currently resolves the
checker through a relative path to a sibling `theokit-skills` checkout; that becomes a dependency on
the published package once it ships.

## Status

Examples are added one at a time, and only when they run. A directory that is not listed below
does not exist yet — an empty stub that fails on `npm start` is worse than an honest gap, because
it costs a reader the clone before it tells them anything.

| Layer | Domain | Runs | Proven | Contract |
|---|---|---|---|---|
| `sdk` | [memory](sdk/memory) | ✅ | ✅ 6 tests | ✅ conformant |
| `framework` | [agent-endpoint](framework/agent-endpoint) | ✅ | ✅ 4 tests | ✅ conformant |

Two of the map below. The layer is the first path segment and the domain is the second, so
`sdk/memory` and `framework/memory` would be the same capability proved on both sides — **a pair**,
which needs no field to declare it.

Pairs are where the sharpest findings come from. Writing the first framework example is what
surfaced [theokit#557](https://github.com/usetheokit/theokit/issues/557): `.memory({enabled:true})`
on the framework's builder forwards the setting and then writes no durable memory, while the SDK
writes it — and the transcript index makes the gap look like it works. The skills corpus grows at the rate this table
does — an agent has a skill for a package exactly when an example here teaches it.

## The map

One axis per level: **layer / domain**. Unchecked entries are planned, not present.

### `sdk` — `@theokit/sdk`, the agent runtime

**memory** ✅ · agents · providers · prompts · reasoning · tools · streaming · workflows · squad ·
sessions · context · compaction · structured-output · goals · tasks · subagents · a2a · handoffs ·
guardrails · permissions · resilience · hooks · schedules · cache · personalities · evals · cost ·
observability · mcp · sandbox · filesystem · acp · skills · errors

### `framework` — `theokit`, the web framework

**agent-endpoint** ✅ · memory · file-routing · http-decorators · auth · websocket · cron ·
deploy-targets

A framework example is a whole app, so it has [its own
anatomy](EXAMPLE-CONTRACT.md#the-framework-anatomy) rather than the library one — and its test
starts the real `theokit dev` and asserts over HTTP.

### `ui` · `tui` — the agent surfaces

thread · tool-calls · permission-modal (React) · chat · diffs · metrics (terminal)

### `di` — `@theokit/di`

container · di-agent · orm

### `plugins` · `gateways` — the first-party packages

payments · realtime · forms · canvas (plugins) · slack · telegram · whatsapp (gateways)

## What an example here owes the reader

1. **It runs.** Clone, install, start. If it needs a key, it says so before it fails.
2. **It pins its version.** A number in `package.json`, not `latest`, so the output in the README
   is the output you get.
3. **It states what the capability does NOT give you.** A blueprint that only shows the happy path
   teaches someone to ship the unhappy one. This is the manifest's `notCovered`, and it is required
   — it becomes the section that stops an agent answering past the evidence.
4. **It marks what it teaches.** A `skill.json` and the lessons it declares, so the example reaches
   an agent instead of only a reader. `npm run check` tells you when it does not.
