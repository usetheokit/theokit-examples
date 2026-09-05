# The example contract

This repository holds runnable examples. A sibling package, `@theokit/skills`, generates agent
skills *from* those examples — it copies their code verbatim into a skill, so a skill can never
teach code that does not run. That guarantee only holds if every example has the same shape: the
same required files, the same manifest schema, the same way of marking which lines are worth
copying.

This document is that shape, written down. The checker that enforces it lives in
`../theokit-skills/lib/example-contract.mjs`; every rule below is named after the string that
checker emits, so if `npm run check` prints

```
FAIL sdk/memory
       lesson-missing: skill.json declares "learn-writes", which no source file opens
```

the fix is under [`lesson-missing`](#lesson-missing) below, not a paragraph you have to hunt for.

## Discovery: what counts as an example

**An example is any directory containing a `skill.json`.** That is the entire discovery rule —
the checker walks the repository from wherever you point it, skipping `node_modules` and
dot-directories, and treats every directory holding a `skill.json` as one example to validate. It
does not care how deep the directory is, or what its parent is called, except for the one
category check below.

If no directory under the given root has a `skill.json`, there is nothing to check, and the
checker exits with an error rather than silently reporting success.

## The category vocabulary

**One axis per level: `<layer>/<domain>`.** The layer is the parent directory and comes from a
closed, fixed list — it names the package an example teaches:

- `sdk` · `framework` · `ui` · `tui` · `di` · `plugins` · `gateways`

The domain is the directory itself: `sdk/memory`, `framework/agent-endpoint`, `ui/thread`.

**A pair needs no declaration.** `sdk/memory` and `framework/memory` are the same capability proved
on both sides, and the structure already says so — same domain, different layer. That pairing is
what surfaced the first divergence between the two layers
([theokit#557](https://github.com/usetheokit/theokit/issues/557)): the SDK writes durable memory
for a setting the framework forwards and then does nothing with.

The vocabulary that came before this one mixed two axes — `capabilities` and `connections` were
domains *of the SDK*, while `component-libraries` and `backend-di` were layers. So `capabilities/`
meant "SDK" by accident rather than by decision, "memory, but in the framework" had nowhere to go,
and the name `theokit-memory` was already spent on one of the two sides.

The list stays closed for the same reason it always was: an open vocabulary drifts from the map a
reader carries in their head. See [`category`](#category) for what happens when a directory doesn't
match.

## The library anatomy

Every example outside the `framework` category has the same four files under `src/`, with the same
four jobs. The uniformity is the point: an agent that has read one example already knows where to
look in the next one, so what it spends attention on is the domain rather than the layout.

| File | Holds | Opens |
|---|---|---|
| `src/cli.ts` | the driver — the command table, and nothing else about the domain | **no lesson.** It ships whole in the generated skill's `example.md`, so an agent that needs the wiring finds it instead of inventing it |
| `src/minimal.ts` | the smallest thing that works | exactly one lesson, `minimal` |
| `src/<domain>.ts` | the capability itself | `setup-*`, `core-*`, `variant-*` |
| `src/pitfalls.ts` | the mistakes, each one runnable | `pitfall-*`, and nothing else |

Any other file under `src/` is a domain file and may open `setup-*` / `core-*` / `variant-*`
lessons; at least one must exist beside the three fixed names.

Two more fixed files sit **outside** `src/`, in `runtime/`, each a byte-identical copy of its
canonical original in `_driver/`: `cli-runtime.ts` (the command runner) and `fake-provider.ts` (the
credential-free provider the tests run against). Outside, because the generator copies `src/` into
the skill's `example.md` — 88 lines of argument parsing would spend an agent's context on
scaffolding that teaches nothing about the SDK. `tsconfig.json` therefore declares
`include: ["src", "runtime", "tests"]` and `rootDir: "."`, so both are still type-checked.

`npm run new -- <category>/<slug>` writes this tree, including the runtime copy. Two things it
cannot decide for you and leaves failing on purpose: the exact `@theokit/sdk` version to pin, and
the `package-lock.json` that `npm install` produces.

### What the driver must do

The driver is the one file a reader can copy and run, so its behaviour is contract rather than
taste. Four exits, and none of them needs a credential:

| Invocation | Prints | Exit |
|---|---|---|
| no arguments, or `--help` / `-h` | the usage text | 0 |
| an unknown command | the error, then the usage text | 2 |
| a known command with a required argument missing | the error | 2 |
| a command that needs no credential | its own output | 0 |

The first row is what gives CI a smoke test that needs nothing configured, and it is why
[`evidence`](#the-skilljson-schema) should carry at least one credential-free command.

**The runner is COPIED into every example, never imported.** It ships whole inside the generated
skill's `example.md` so an agent finds the wiring instead of inventing it — and an
`import { runCli } from "@theokit/example-kit"` would hand that agent a framework that does not
exist in its project, plus a dependency no consumer of the SDK installs.

Copying is only safe while the copies are provably identical, which is what
[`driver-drift`](#driver-drift) enforces. The workflow:

```sh
$EDITOR _driver/cli-runtime.ts     # the one true copy
npm run sync                       # push it into every example's runtime/
npm run check                      # driver-drift confirms nobody is behind
```

So `cli.ts` holds one command table and one call to `runCli`, and the usage text is derived from
the table — a usage line cannot outlive the command it described.
`sdk/memory/src/cli.ts` is the reference.

### The `framework` anatomy

A `framework` example is a whole theokit app, so the library anatomy does not describe it. What the
first one (`framework/agent-endpoint`) settled, and what the checker now expects:

| | |
|---|---|
| `agents/`, `app/` | the app itself. `app/` is required by the framework, not by this contract |
| `agents/lib/`, `agents/tools/`, … | thirteen reserved names that are composition concerns, never routes. Lessons about pitfalls live here — `agents/pitfalls.ts` would have been served at `POST /api/agents/pitfalls` |
| `runtime/fake-provider.ts` | required. `cli-runtime.ts` is not: an app has no CLI |
| `tests/` | starts the real `theokit dev` and asserts over HTTP |
| `theo.config.ts` | **required, even when empty.** `theokit dev` refuses to start without it — *"Invalid Theo project structure — Missing required file: theo.config.ts"* |
| `tsconfig.json` | `include` names the directories holding lessons, which is what `lesson-location` reads |

`start` is the app's own start command, so the four driver exits do not apply — `npm test` is the
credential-free proof instead.

**`theo.config.ts` was missing from this table until `framework/memory` was written against it.**
The anatomy listed five things, all five were produced, and `theokit dev` refused to start — so an
author following the documented shape got an app that could not run, and the error naming the real
requirement only appeared after the test suite had already timed out four times waiting for a port.

That is the failure mode this table exists to prevent, and it had it: an anatomy that is *almost*
complete reads exactly like one that is complete. `required-files` cannot catch it either, because
that rule governs the six files every example shares, and this one is the framework layer's alone.

## Lesson roles

A lesson id declares what the lesson is FOR, in its prefix. The array order in `skill.json` is the
teaching order; the prefix is what tells an agent whether it is looking at the smallest working
form, a variation it may not need, or a mistake it is about to make — without a sentence of prose
having to say so.

| Prefix | The lesson shows |
|---|---|
| `minimal` (exact, no suffix) | the fewest lines that work |
| `setup-<what>` | what must exist before the capability can be used |
| `core-<what>` | the central gesture of the domain |
| `variant-<what>` | a variation on the core one worth knowing |
| `pitfall-<what>` | a mistake, with the symptom it actually produces |
| `verify-<what>` | how to confirm it worked |

**The wrong way travels as a comment, above the right one.** `strict: true` means broken code
cannot compile, and that is worth keeping — so the mistake is written where it bit, in the prose
that gets copied verbatim, with the observable symptom attached:

```ts
// #region lesson:core-send-and-wait
// WRONG: `await agent.send(m)` alone returns a handle whose status is "running".
// Symptom: prints nothing, twice, while the memory file on disk is written correctly.
//   const answer = await agent.send(message);   // no text here, ever
const run = await agent.send(message);
const finished = await run.wait();
// #endregion
```

## The `skill.json` schema

`skill.json` is one half of the contract between this repository and `@theokit/skills` (the
schema itself lives in `../theokit-skills/lib/skill-manifest.mjs`). Every field is required unless
noted:

| Field | Shape | Notes |
|---|---|---|
| `skill` | string | kebab-case, and must equal `theokit-<layer>-<domain>` — e.g. `sdk/memory` declares `theokit-sdk-memory`. The layer is in the name because a pair shares its domain, and an agent reading the name has to know which API it is about to be handed |
| `concept` | non-empty string | what this example teaches, in one sentence |
| `teaches` | non-empty array of strings | each entry is a `@theokit/...` export subpath, e.g. `@theokit/sdk/memory` — a bare package root (e.g. `@theokit/sdk`) is also valid when the capability is configured through the root export, as `sdk/memory` is |
| `triggers` | non-empty array of strings | phrases that should cause an agent to reach for this skill |
| `notCovered` | non-empty array of strings | what this example deliberately does not teach |
| `lessons` | non-empty array of `{ id, explains }` | `id` is kebab-case and must match a lesson marker opened in the example's source (see below); `explains` is a non-empty sentence |
| `credentials` | array of strings (optional, defaults to `[]`) | environment variables a reader must set before running the example |
| `evidence` | array of `{ command, claims }` (optional, defaults to `[]`) | a command that was actually run, and what its output proves. At least one SHOULD run without a credential |
| `seeAlso` | array of `theokit-*` skill names (optional, defaults to `[]`) | the neighbouring domains. An agent that cannot reach the adjacent skill writes the adjacent code from memory, which is the failure the corpus exists to prevent |
| `requires` | array of `theokit-*` skill names (optional, defaults to `[]`) | the conceptual prerequisites. This is what gives the corpus a reading order |

Neither neighbour field may name the skill itself.

A `skill.json` that fails this shape — wrong types, empty arrays where a non-empty one is
required, an `id` that isn't kebab-case, a `teaches` entry that doesn't match the `@theokit/<package>` pattern —
is reported under [`manifest`](#manifest).

## Lesson markers

A lesson is a fenced block inside a source file, delimited by comment markers:

```ts
// #region lesson:learn-writes
...your code, including its comments...
// #endregion
```

**The marker keeps the editor's `#region` syntax on purpose.** VS Code and Visual Studio fold on
it, so a lesson folds like any other region and nobody has to learn a private syntax to collapse
one. What says the block is a lesson rather than a fold is the `lesson:` namespace after it — and
that namespace is also what the parser requires, so an ordinary `// #region helpers` in an example
is left alone.

The id after `lesson:` must be kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). A line that almost
matches — wrong casing, a typo, a stray character — simply isn't recognized as a lesson marker at
all; it will not open a lesson, and if it was meant to reference an id declared in `skill.json`,
that id will come up as [`lesson-missing`](#lesson-missing) instead of a syntax error, because as
far as the parser is concerned nothing opened it.

**Everything between `#region` and `#endregion` is copied verbatim into the generated skill,
comments included.** This is the single most important property of this repository. It means:

- A doc comment inside a lesson is not internal bookkeeping — it is the prose a future reader of
  the generated skill will actually see. Write it for that reader, not for a teammate reviewing
  the diff.
- There is no paraphrasing step between an example and the skill built from it. If a comment is
  wrong, sloppy, or refers to something outside the lesson, that flaw ships.
- The most valuable writing in this repository is not the README. It is the comments inside
  `// #region lesson:` blocks, because they are the only prose that travels.

## Rules

### `required-files`

Every example must contain, at its own top level: `skill.json`, `package.json`,
`package-lock.json`, `tsconfig.json`, `README.md`, `.gitignore`. Missing any one of them is
reported by name (`missing README.md`, etc).

Why: everything else the checker verifies — the manifest schema, the pinned dependency, the
strict compiler flag, the ignored build output — lives in one of these six files. An example
missing one of them isn't a smaller violation of the contract; it's a file the rest of the
contract has nothing to check.

### `readme-format`

Every `README.md` opens with exactly seven lines, in this order:

```markdown
> ## Documentation Index
> Fetch the complete example index at: llms.txt (this repository's root)
> Use this file to discover all available examples before exploring further.

# How a file becomes an HTTP route

> Serve an agent by creating a file — its path is the route, and nothing registers it.
```

The index pointer, then the title, then one blockquote line saying what the page is.

Why: **the reader is usually an agent, and it usually arrives in the middle.** The corpus exists
to be read by something that landed on one example without knowing the other six are there — so
the first thing on the page is where the rest of them are listed, before any prose it might stop
reading. The title is phrased as what the reader will be able to DO, not as the directory's name:
`# How an agent remembers your project` answers a question somebody asked; `# Memory` names a
folder.

The single blockquote line is the sentence that survives being the only thing anyone reads. It is
the one piece of prose that has to work with no context around it.

The shape is Claude Code's own documentation shape, adopted rather than invented: it is already
what one large corpus of agent-facing docs settled on, and a reader trained on that shape finds
what it expects here.

Checked by `scripts/check-structure.mjs`, not by the skills checker — it is a property of the
corpus rather than of one example.

### `index-stale`

`llms.txt` at the repository root must match what `scripts/build-index.mjs` would generate from
the examples on disk. **Absent counts as stale**, never as "not applicable".

Why: the index is what an agent fetches to learn what the corpus holds before opening anything, so
an index that disagrees with the directories reports absence where an example exists — and a
reader that stops at the index never finds the contradiction. Nothing forces the two to move
together, which is exactly why a check has to.

Regenerate with `npm run index`; never edit `llms.txt` by hand.

Treating absence as staleness is deliberate. The alternative lets a repository opt out of the
check by never having the file, which is how an index ends up missing everywhere it matters.

### `dangling-neighbour`

Every name in a manifest's `seeAlso` or `requires` must be the `skill` of an example that exists
in this repository, and may not be the example's own name.

Why: the contract already states what these fields are for — *"an agent that cannot reach the
adjacent skill writes the adjacent code from memory, which is the failure the corpus exists to
prevent."* Nothing enforced it, so a manifest could declare a reading order the corpus could not
walk, and the declaration read exactly like one that worked.

The first run of this check found one: `sdk/memory` names `theokit-framework-memory`, the
framework half of the pair, which is not written yet. That is the honest state of the corpus, and
a red line naming it is worth more than a green one that removed the intent.

### `category`

The example's parent directory name must be one of the [closed category vocabulary](#the-category-vocabulary)
above.

Why: the category is how a reader finds this example from the README's map, and how the generated
skill gets filed on the other side. A category outside the list is a filing location nobody's map
agrees on.

### `invalid-json`

`skill.json`, `package.json`, and `tsconfig.json` must each parse as JSON. A syntax error in any
of them is reported with the parser's own message, and checking of that specific file's contents
stops there — but the checker still runs every other check it can, so a broken `tsconfig.json`
doesn't hide a broken `package.json` in the same run.

Why: every other rule about these three files assumes it can read them as data. A malformed file
is not a smaller version of "missing `strict: true`" — it's a file with no fields to check yet.

### `manifest`

`skill.json`, once it parses as JSON, must satisfy the [schema above](#the-skilljson-schema), and
its `skill` field must equal `theokit-<layer>-<domain>` — e.g. `sdk/memory/skill.json` must declare
`"skill": "theokit-sdk-memory"`.

Why: `@theokit/skills` reads this file to know what it's generating and where to file it. A
manifest whose `skill` field doesn't match its own directory produces a skill filed under the
wrong name; a manifest that's merely malformed (an empty `teaches`, a `lessons` entry missing
`explains`) produces a skill with holes in exactly the fields a reader needs to decide whether to
trust it.

### `package-name`

`package.json`'s `name` field must equal `theokit-example-<layer>-<domain>` — e.g.
`sdk/memory/package.json` must declare `"name": "theokit-example-sdk-memory"`.

Why: the same predictability as `manifest`, for the file npm actually reads. A name that drifts
from its directory is confusing the moment two examples are open in adjacent terminal tabs.

### `package-fields`

`package.json` must set `"private": true` and `"type": "module"`.

Why: `private: true` stops an example from ever being accidentally published to npm — these are
demonstrations, not packages anyone should `npm install`. `type: module` keeps every example on
the same module system, so a reader moving between examples never has to notice the difference
between `require` and `import`.

### `required-scripts`

`package.json` must define `start`, `typecheck` and `test` scripts, each as a string.

Why: this repository's own README promises `npm install && npm start` runs any example — that
promise only holds if `start` exists. `typecheck` exists because [`strict-typescript`](#strict-typescript)
is enforced on the *configuration*, not by actually invoking the compiler; the `typecheck` script
is what makes that configuration checkable by a human or a CI run, on demand.

### `exact-pin`

Every dependency or devDependency belonging to this ecosystem — `theokit`, `create-theokit`,
`@theokit/*` and `@usetheo/*` — must be pinned to an exact
version — a bare `major.minor.patch`, optionally with a prerelease suffix (`4.61.0`,
`4.61.0-beta.1`). Ranges (`^4.61.0`, `~4.61.0`), tags (`latest`, `next`), and workspace links are
all rejected.

One prerelease shape is refused: a **changesets snapshot**, recognised by the trailing 14-digit UTC
timestamp `changeset version --snapshot <tag>` appends (`0.64.1-pr479-20260831130000`). A snapshot
is published to verify a fix from the registry before a release cut, under a dist-tag that is
deliberately not `latest` — it is a throwaway, and a stranger never installs one. The intended
sequence is publish, verify, then pin the release; nothing made the last step happen, and npm
versions are immutable after 72 hours, so a snapshot left behind resolves forever while the example
demonstrates a tree that was never released (`usetheokit/theokit-skills#24`).

The match is anchored on the timestamp rather than on any tag, because the tag comes from a dispatch
input and matching one workflow's would leave the next one's open.

Why: this repository's README states its central promise in the first paragraph — every example
installs theokit from npm, at a pinned version, exactly as a stranger would. A floating range
means the code a reader is looking at and the code `npm install` actually resolves can silently
diverge between the day the example was written and the day it's read.

The list is by name rather than by prefix because **`theokit` carries no scope**. A rule testing
`@theokit/` misses the framework package itself — the single dependency a `framework` example leans
on hardest. Third-party packages are deliberately excluded: pinning React would say nothing about
what a reader installs from us.

### `strict-typescript`

`tsconfig.json` must set `compilerOptions.strict` to `true`.

Why: code inside a lesson is copied verbatim into a generated skill. Loose type-checking lets
mistakes through that strict mode would catch at edit time — and a mistake that ships in a skill
is a mistake taught to every agent that skill triggers for.

### `gitignore`

`.gitignore` must ignore both `node_modules/` and `dist/`.

Why: neither belongs in version control — one is reinstallable, the other is rebuildable — and an
example that accidentally commits either makes every diff in this repository noisier for everyone
who touches it afterward.

### `lesson-syntax`

Every `// #region lesson:<id>` must be matched by exactly one `// #endregion`, lessons must not
nest, and no `#endregion` may appear without an open lesson.

Why: a lesson is what gets copied into the generated skill. If the parser can't tell where a
lesson starts and ends, there is no well-defined text to copy — the ambiguity has to be resolved
by a human before it can be resolved by a machine.

### `lesson-location`

Every lesson must be opened inside a directory that `tsconfig.json` declares in its `include` —
`src` for a library example, `app` / `agents` / `server` for a framework one. An `include` whose
first path segment is a glob makes every path qualify; an absent `include` means `src`.

Why: what `tsconfig` includes is exactly what gets built and type-checked. A lesson opened outside
it — in a README code fence, a config file, a script — is prose or configuration wearing a lesson
marker, not code that was proven to run. The rule reads the declaration rather than hard-coding
`src/`, because a framework example has no `src/` and hard-coding it would make lesson markers
unusable in the examples that teach the framework.

### `lesson-duplicate`

A lesson id must appear at most once across all of an example's source files.

Why: `skill.json` maps one id to one body of code. If two files both open a lesson with the same
id, there is no way to say which body the manifest's `explains` field is describing — the mapping
stops being a mapping.

### `lesson-missing`

Every lesson id listed in `skill.json`'s `lessons` array must be opened by some file under `src/`.

Why: a manifest entry with no matching lesson is a promise the code doesn't keep — `skill.json`
says "this example teaches X, here is where," and there is no "here."

### `lesson-undeclared`

Every lesson opened under `src/` must have a matching entry in `skill.json`'s `lessons` array.

Why: the reverse of `lesson-missing`. A lesson nobody declared is either dead — code someone
marked for extraction and then forgot to wire into the manifest — or a sign the manifest is out of
date with the code. Either way, `@theokit/skills` has no `explains` text to generate a skill
section from, so the lesson would be silently dropped rather than silently included.

### `anatomy`

For every example outside the `framework` category: `src/cli.ts`, `src/minimal.ts` and
`src/pitfalls.ts` all exist, at least one other source file sits beside them, and each of the three
opens only what [the anatomy](#the-library-anatomy) allows — the driver opens nothing, `minimal.ts`
holds only `minimal`, `pitfalls.ts` holds only `pitfall-*`, and no `pitfall-*` is opened anywhere
else.

Why: fifty examples in fifty shapes turn the extractor into a pile of special cases, and every
special case is a chance to extract the wrong thing quietly. It also costs the reader: an agent
that has to relearn the layout in each example spends its attention on the layout.

### `proof`

Every example declares a `test` script, carries at least one `tests/*.test.ts`, and **every lesson
id in `skill.json` is named by some test file**. The violation names the lessons nobody proves.

Why: a lesson is code the generator copies verbatim into a skill, so a lesson nobody executes is a
claim — and this repository publishes claims to agents that cannot check them. Type-checking proves
the code compiles against the published types, not that it runs.

A credential is not an excuse. Three of the SDK's providers declare `authType: "none"` on a
`localhost` baseUrl, so `runtime/fake-provider.ts` serves that protocol and a real agent run fits
inside a test — the SDK resolves the provider, opens the transport, streams and parses, exactly as
it would against a hosted model. What it does not do is consult a model, so a test built on it
proves plumbing and never proves an answer. Say that in the `claims`.

**Honest limit:** this checks that a test file NAMES each lesson id, not that it asserts anything
about it. It catches the lesson somebody forgot, not the assertion somebody wrote badly.

### `driver-drift`

For every example outside the `framework` category: every `.ts` in `_driver/` has a byte-identical
copy under `runtime/`. Adding a file to `_driver/` therefore ships it to every example on the next
`npm run sync`, and fails the check until that is run. A missing canonical directory is reported
too, rather than skipping the check.

Why: the runner is duplicated across every example by design (see [What the driver must
do](#what-the-driver-must-do)), and duplication without a check is how forty-five copies of one bug
happen. Reporting the absent canonical rather than passing follows the rule the rest of this
contract uses: a check that disarms itself when its input is missing reads exactly like a check
that passed.

### `lesson-role`

Every lesson id is `minimal`, or `<role>-<what>` where `<role>` is one of `setup`, `core`,
`variant`, `pitfall`, `verify`. A bare role with nothing after it does not count.

Why: see [Lesson roles](#lesson-roles). An id with no role still identifies a block of code, but it
tells the reader nothing about why that block is in the skill, and the manifest's `explains` is
then carrying work the id could have done for free.

## The `check` script and the path it takes

This repository's root `package.json` defines one script:

```json
"check": "node ../theokit-skills/bin/check-example.mjs ."
```

The relative path (`../theokit-skills`) is a **development convenience**, not a permanent
arrangement. It assumes `theokit-skills` and `theokit-examples` are checked out as sibling
directories on the same machine, which is true in this development environment but is not
something a stranger cloning only `theokit-examples` can rely on.

Once `@theokit/skills` is published to npm, this script is meant to become a devDependency-backed
call — `npx theokit-skills check .` or similar — with the checker resolved from `node_modules`
like any other tool. That change waits on the package actually shipping, which in turn waits on
`skills/` (the generated output) having something in it. Wiring CI to a checker that isn't
published yet, or trusting an unpublished sibling-directory path from a hosted runner, would give
every pull request a red check it can never turn green — so no CI workflow exists in this
repository yet. Until the package ships, `npm run check` is a local command, run from a checkout
that has `theokit-skills` beside it.
