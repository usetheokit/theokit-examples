# theokit examples

Runnable examples for the theokit ecosystem. One directory per documented capability.

**Every example installs theokit from npm, at a pinned version, exactly as a stranger would.**
None of them link to a local checkout. That is the point: an example that resolves through a
workspace tests the repository it lives in, not the experience of the person who typed
`npm install`. This repository is deliberately outside the SDK so that it cannot cheat.

The cost of standing outside is that an example can rot without the SDK's CI noticing. That is
answered by CI here — each example is installed fresh from the registry and run on a schedule, so
rot surfaces as a red build in this repository rather than as a wasted afternoon for a reader.

## How to run one

```sh
cd capabilities/memory
npm install
npm start
```

Each example states which credentials it needs, and every one that can run without a model
provides a fixture path that does.

## Status

Examples are added one at a time, and only when they run. A directory that is not listed below
does not exist yet — an empty stub that fails on `npm start` is worse than an honest gap, because
it costs a reader the clone before it tells them anything.

| Capability | Status |
|---|---|
| [Memory](capabilities/memory) | ✅ runnable |

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
   teaches someone to ship the unhappy one.
