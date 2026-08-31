> ## Documentation Index
> Fetch the complete example index at: llms.txt (this repository's root)
> Use this file to discover all available examples before exploring further.

# How a served agent's memory gets classified

> Prove the store survives the trip through HTTP unchanged — and see who actually decides whether Claude Code can categorise it.

[`sdk/claude-code-memory`](../../sdk/claude-code-memory/README.md) compares the SDK's layout against
a recording of a real Claude Code session. This is the half that side cannot ask: the store here is
written by a **real `theokit dev` server running a real agent over HTTP**, and the question is
whether anything about the shape changes on the way.

Nothing does. What changes is decided somewhere else entirely.

This page covers how to:

* [See that the layer changes nothing](#the-trip-changes-nothing)
* [See who decides the classification](#the-kind-comes-from-the-callers-text) — it is not the agent
* [Run it](#what-npm-test-actually-does) with no credential

```sh
npm install
npm test
```

Pinned to `theokit@0.63.0`, `@theokit/agents@12.1.0` and `@theokit/sdk@4.63.1`.

## The trip changes nothing

The store a served agent writes is shaped like the store a direct `appendFact` writes: one
`MEMORY.md` index whose entries read `- [Title](file.md) — hook`, plus one file per memory carrying
the same frontmatter keys. Measured through the real server, not assumed from the call graph.

That is worth asserting precisely because it is boring. The framework mounts the agent, validates
the body, runs the SDK and streams the reply — four places a shape could drift, and a suite that
never looked would report nothing when one of them did.

## The kind comes from the caller's text

The Claude Code CLI records every memory's kind as `metadata.type`, one of `user`, `feedback`,
`project`, `reference`. The SDK writes that field **only when the fact carries a kind**, and the kind
is parsed from the user's message:

| the caller sends | stored | `metadata.type` |
|---|---|---|
| `Remember (project): …` | yes | `project` |
| `Remember: …` | yes | **none** |

Both are valid stores. The difference is not validity — it is whether a reader that groups by kind,
as the CLI does, can see the memory at all.

**In a served app the caller builds the request body.** So this is decided by the browser, the typed
client, or the other service composing the message — not by `agents/remember.ts` and not by the
framework. A UI that sends a bare `Remember:` produces memories the CLI can read and cannot
categorise, and nothing anywhere reports that.

The agent cannot fix this for you: it never sees a kind it was not given.

## What `npm test` actually does

Starts the real `theokit dev` with `LLM_MODEL` pointed at a local stub that speaks the wire
protocol. Routing, agent compilation, the SDK and the memory write are all real; only the model at
the far end is replaced — and the write happens in the SDK either way, so the stub removes nothing
this suite asserts.

| assertion | what it proves |
|---|---|
| the file and the index appear, index entry in the CLI's shape | the trip through the server preserves the layout |
| `Remember (project):` → `metadata.type` in `KINDS` | a declared kind survives to disk |
| `Remember:` → stored, no `metadata.type` | the bare form is accepted and unclassifiable |
| a request without `X-Theo-Action` → 403 | the route is CSRF-protected by default |
| the boot refuses nothing | `export const policy` is the declaration the route gate reads |

## What this does not teach

The layout comparison against the CLI itself — that is
[`sdk/claude-code-memory`](../../sdk/claude-code-memory/README.md), against a recorded session with
its version. Recall quality, per-user stores, and the React side are out of scope here.
