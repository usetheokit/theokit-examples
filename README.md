# theokit examples

Runnable examples for the theokit ecosystem. One directory per documented capability.

**Every example installs theokit from npm, at a pinned version, exactly as a stranger would.**
None of them link to a local checkout. That is the point: an example that resolves through a
workspace tests the repository it lives in, not the experience of the person who typed
`npm install`. This repository is deliberately outside the SDK so that it cannot cheat.

The cost of standing outside is that an example can rot without the SDK's CI noticing. Nothing here
answers that yet — **this repository has no CI**. Until it does, an example is only as fresh as the
last time somebody ran it, and that is a gap rather than a plan.

## How to run one

```sh
cd capabilities/memory
npm install
npm start
```

Each example states which credentials it needs.

## These examples are the source of the agent skills

An example here is not only documentation. [`@theokit/skills`](https://github.com/usetheokit/theokit-skills)
generates agent skills from this repository by **copying marked regions of the source verbatim** —
so a skill can never teach code that does not run, because the code in the skill is the code CI
executed.

That has one consequence worth knowing before you write an example: **everything inside a region is
copied, comments included.** The doc comments in `capabilities/memory/src/assistant.ts` recording
that `agent.send()` returns a handle rather than a result, and that `PermissionEngine` takes its
rules positionally so the object form builds an engine with no usable rule list, are not asides —
they are the most valuable prose in this repository, and the generator carries them rather than
restating them. Write the pitfall where it bit you.

Two artifacts make an example extractable: a `skill.json` manifest, and `#region skill:<id>` markers
around the code that teaches. Both are specified in **[EXAMPLE-CONTRACT.md](EXAMPLE-CONTRACT.md)**,
along with the 15 rules the checker enforces, each documented under the name its failure message
prints.

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

| Capability | Runs | Contract |
|---|---|---|
| [Memory](capabilities/memory) | ✅ | ✅ conformant |

One of roughly fifty capabilities on the map below. The skills corpus grows at the rate this table
does — an agent has a skill for a package exactly when an example here teaches it.

## The map

The sections below mirror the documentation. Unchecked entries are planned, not present.

### Build agents

Agents · File-based config · Providers and models · Prompts and instructions · Reasoning · Tools ·
Streaming · Workflows · Squad

### Capabilities

**Memory** ✅ · Sessions · Context · Compaction · Structured output · Goals · Tasks · Subagents ·
A2A · Handoffs · Guardrails · Permissions · Resilience · Hooks · Schedules · Cache · Personalities ·
Evals · Cost · Observability

### Connections

MCP · Sandbox · Filesystem · ACP server · Subscriptions · Serving agents · Cloud runtime

### Extensibility

Skills · Errors

### Learn more

Concepts · Cookbook · API reference

### Component libraries

UI (React) · TUI (terminal)

### Backend / DI

DI (container) · DI-Agent · ORM (Drizzle)

### Framework plugins

Plugins · Gateways

## What an example here owes the reader

1. **It runs.** Clone, install, start. If it needs a key, it says so before it fails.
2. **It pins its version.** A number in `package.json`, not `latest`, so the output in the README
   is the output you get.
3. **It states what the capability does NOT give you.** A blueprint that only shows the happy path
   teaches someone to ship the unhappy one. This is the manifest's `notCovered`, and it is required
   — it becomes the section that stops an agent answering past the evidence.
4. **It marks what it teaches.** A `skill.json` and the regions it declares, so the example reaches
   an agent instead of only a reader. `npm run check` tells you when it does not.
