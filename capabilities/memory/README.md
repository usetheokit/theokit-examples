# Memory

A small project assistant that remembers your conventions between runs, run entirely from the
terminal.

```sh
npm start -- learn "deploys go through the release branch, never main"
npm start -- ask   "which branch do deploys go through?"
```

`learn` and `ask` are **separate processes**. Nothing is shared between them but the directory on
disk — no conversation, no transcript, no handle held open. If `ask` answers correctly, memory is
the only path the answer could have taken. Memory itself lives in
`<project-dir>/.theokit/memory/` — markdown files you can read, edit, and commit like any other
file in your repository.

## Before you run it

This example calls a real model, so it needs a **provider credential** in your environment — an
API key for whichever provider `THEOKIT_MODEL` points at. Without one, every command fails at the
first call, and the failure message points back here.

### Environment variables

| Variable | Default | What it controls |
|---|---|---|
| `THEOKIT_MODEL` | `openai-chatgpt/gpt-5.4-mini` | Which model the assistant runs on. Set this to point at a different provider; you still need that provider's credential. |
| `THEOKIT_PROJECT_DIR` | `./workspace` | Where the memory store lives. Resolved to an absolute path, so it is safe to run the CLI from any working directory. |

## Commands

```sh
npm start -- learn "<something about your project>"
npm start -- ask   "<a question>"
npm start -- demo:poisoned
npm start -- verify:permissions [n]
```

- **`learn "<something>"`** — tells the assistant to remember the given fact. Internally this
  sends `Remember (project): <something>` to the agent; nothing is written to memory unless a
  `learn` call asks for it explicitly. The assistant does not mine ordinary conversation for facts
  to keep.
- **`ask "<a question>"`** — sends the question to a fresh process and prints the answer. If the
  answer reflects something a prior `learn` call recorded, that fact came from the memory store on
  disk, not from anything carried over in-process.
- **`demo:poisoned`** — shows the failure mode a happy-path example will not: the memory store is
  a directory, and anything that can write to it can place a sentence in front of the agent at the
  start of a future session. This command plants such an entry by hand (no agent involved), then
  runs the assistant twice against a temporary project — once with the permission layer disabled,
  once with it enabled (the default in this example) — and reports whether the planted instruction
  produced an action.
- **`verify:permissions [n]`** — re-runs the same planted-entry scenario `n` times per arm (default
  `6`) and reports counts, distinguishing a run that was blocked from a run that threw an
  exception. It exists because an earlier proof script constructed the permission engine
  incorrectly and could not tell the two apart; this command is the corrected, typed
  re-verification.

## What this example does not cover

Memory here is scoped to a single project directory, written to only on an explicit `learn`. It
does not cover session-level memory, cross-project memory, or automatic fact extraction from
ordinary conversation — those are different capabilities with their own examples once written.
