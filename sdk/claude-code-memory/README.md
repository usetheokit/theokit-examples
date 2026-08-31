> ## Documentation Index
> Fetch the complete example index at: llms.txt (this repository's root)
> Use this file to discover all available examples before exploring further.

# How to prove the SDK writes memory the way Claude Code does

> Compare the SDK's memory store against a recording of a real Claude Code session — and read the differences instead of a yes or no.

Two programs write to the same kind of directory: the Claude Code CLI, and `@theokit/sdk`. Whether
an agent can read what the other one saved is a question about **file layout**, and the only way to
answer it honestly is to make both write and then look.

This page covers how to:

* [Run the comparison](#the-answer-today) — no credential, no CLI login
* [See what the two disagree about](#the-three-divergences), measured rather than asserted
* [Refresh the recording](#the-oracle-is-a-recording-not-the-docs) from a live session
* [Avoid the mistake that produced a wrong answer](#the-mistake-worth-more-than-the-fix)

```sh
npm install
npm test                  # the conformance assertions, credential-free
npm start -- compare      # the same comparison, printed
```

Pinned to `@theokit/sdk@4.63.1`.

## The answer today

```
files:      MEMORY.md, project-pins-vitest-never-uses.md
index:      1 entry(ies), heading: true
frontmatter description, metadata, metadata.modified, metadata.node_type,
            metadata.observations, metadata.type, name

against claude 2.1.236, captured 2026-08-31:
  - MEMORY.md opens with a heading; the CLI's does not
  - frontmatter is missing `metadata.originSessionId`, which the CLI writes
  - frontmatter carries `metadata.observations`, which the CLI does not write
```

The **tree** matches: one `MEMORY.md` index plus one file per memory, and index entries in the same
`- [Title](file.md) — hook` shape. What differs is listed above, and the suite asserts **three** —
not zero. A test asserting "no divergence" would be a wish, and would have been red from the day it
was written.

## The three divergences

| | CLI | SDK | costs |
|---|---|---|---|
| index heading | none | `# Memory Index` | two of the 200 lines the CLI loads |
| `metadata.originSessionId` | written | absent | the CLI cannot trace a fact to its session |
| `metadata.observations` | absent | written | nothing known — extra keys are carried |

There is a fourth, and it is the one that actually breaks reading:

**The SDK keys the Claude Code store by `cwd`. The CLI keys it by the git repository root.** Two
real sessions, driven from subdirectories of a fresh repo, both put the memory on the repo root; the
subdirectories got only a session transcript and no `memory/` directory at all. So an agent started
anywhere below the root reads a directory the CLI never wrote to, finds nothing, and reports
nothing — no error, no warning. Tracked as
[theokit-sdk#479](https://github.com/usetheokit/theokit-sdk/issues/479), and pinned by
`lesson pitfall-git-root-keying` so it cannot be fixed silently.

Transcripts **are** keyed by `cwd`, correctly. The two artefacts live on different axes, and one
encoder serving both is what produced the defect.

## The oracle is a recording, not the docs

`CLAUDE_CODE_LAYOUT` is what a real `claude 2.1.236` session wrote, captured on 2026-08-31, carrying
both facts in the value itself. Refresh it with:

```sh
npm start -- oracle       # needs a logged-in `claude` on PATH; ~2 minutes; spends tokens
```

It is a command and not a test on purpose. Requiring a credential would make the suite unrunnable
for everyone else, and a test that silently skips when the CLI is absent reports green on every
machine that cannot run it — which is the exact failure this example is about.

The capture runs from a **nested subdirectory** of a fresh repo. That is not incidental: running
from the repo root makes cwd-keying and git-root-keying indistinguishable, and the capture worthless.

## The mistake worth more than the fix

The first answer this example produced was wrong, and it was wrong in a way that looked measured.

Counting project directories that HAVE a `memory/` said the CLI keys by `cwd`. Counting those with
a `.md` inside says otherwise:

```
139 project directories have memory/
111 of them hold any .md
```

The four directories cited as proof all had `memory/` and all held zero files. `lesson
pitfall-empty-memory-dir` asserts the property that makes this possible: an empty store and an
absent one describe **identically**.

Count content, never containers.

## What this does not teach

Whether recall finds the right fact once it is stored ([`sdk/memory`](../memory/README.md) covers
the store; retrieval quality is neither example's claim), `CLAUDE.md` and `.claude/rules/` — written
by hand, by neither writer — and whether any divergence above MATTERS for a given app. This measures;
it does not rank.
