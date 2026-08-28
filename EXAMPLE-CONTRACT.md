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
FAIL capabilities/memory
       region-missing: skill.json declares "learn-writes", which no source file opens
```

the fix is under [`region-missing`](#region-missing) below, not a paragraph you have to hunt for.

## Discovery: what counts as an example

**An example is any directory containing a `skill.json`.** That is the entire discovery rule —
the checker walks the repository from wherever you point it, skipping `node_modules` and
dot-directories, and treats every directory holding a `skill.json` as one example to validate. It
does not care how deep the directory is, or what its parent is called, except for the one
category check below.

If no directory under the given root has a `skill.json`, there is nothing to check, and the
checker exits with an error rather than silently reporting success.

## The category vocabulary

Every example's *parent* directory name — the folder one level up, e.g. `capabilities` in
`capabilities/memory` — must be one of a closed, fixed list:

- `build-agents`
- `capabilities`
- `connections`
- `extensibility`
- `component-libraries`
- `backend-di`
- `framework-plugins`

These mirror the sections in this repository's own [README](README.md#the-map). The list is
closed deliberately: an open vocabulary lets categories drift from the map a reader already has in
their head, and "just add a new one" is exactly the kind of local convenience that makes the map
stop being trustworthy. See [`category`](#category) for what happens when a directory doesn't
match.

## The `skill.json` schema

`skill.json` is one half of the contract between this repository and `@theokit/skills` (the
schema itself lives in `../theokit-skills/lib/skill-manifest.mjs`). Every field is required unless
noted:

| Field | Shape | Notes |
|---|---|---|
| `skill` | string | kebab-case, must start with `theokit-`, and must equal `theokit-<directory-slug>` |
| `concept` | non-empty string | what this example teaches, in one sentence |
| `teaches` | non-empty array of strings | each entry must look like a `@theokit/...` export subpath, e.g. `@theokit/sdk/memory` |
| `triggers` | non-empty array of strings | phrases that should cause an agent to reach for this skill |
| `notCovered` | non-empty array of strings | what this example deliberately does not teach |
| `regions` | non-empty array of `{ id, explains }` | `id` is kebab-case and must match a region marker opened in the example's source (see below); `explains` is a non-empty sentence |
| `credentials` | array of strings (optional, defaults to `[]`) | environment variables a reader must set before running the example |
| `evidence` | array of `{ command, claims }` (optional, defaults to `[]`) | a command that was actually run, and what its output proves |

A `skill.json` that fails this shape — wrong types, empty arrays where a non-empty one is
required, an `id` that isn't kebab-case, a `teaches` entry that isn't a `@theokit/...` subpath —
is reported under [`manifest`](#manifest).

## Region markers

A region is a fenced block inside a source file, delimited by comment markers:

```ts
// #region skill:learn-writes
...your code, including its comments...
// #endregion
```

The id after `skill:` must be kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). A line that almost
matches — wrong casing, a typo, a stray character — simply isn't recognized as a region marker at
all; it will not open a region, and if it was meant to reference an id declared in `skill.json`,
that id will come up as [`region-missing`](#region-missing) instead of a syntax error, because as
far as the parser is concerned nothing opened it.

**Everything between `#region` and `#endregion` is copied verbatim into the generated skill,
comments included.** This is the single most important property of this repository. It means:

- A doc comment inside a region is not internal bookkeeping — it is the prose a future reader of
  the generated skill will actually see. Write it for that reader, not for a teammate reviewing
  the diff.
- There is no paraphrasing step between an example and the skill built from it. If a comment is
  wrong, sloppy, or refers to something outside the region, that flaw ships.
- The most valuable writing in this repository is not the README. It is the comments inside
  `// #region` blocks, because they are the only prose that travels.

## Rules

### `required-files`

Every example must contain, at its own top level: `skill.json`, `package.json`,
`package-lock.json`, `tsconfig.json`, `README.md`, `.gitignore`. Missing any one of them is
reported by name (`missing README.md`, etc).

Why: everything else the checker verifies — the manifest schema, the pinned dependency, the
strict compiler flag, the ignored build output — lives in one of these six files. An example
missing one of them isn't a smaller violation of the contract; it's a file the rest of the
contract has nothing to check.

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
its `skill` field must equal `theokit-<directory-slug>` — e.g. `capabilities/memory/skill.json`
must declare `"skill": "theokit-memory"`.

Why: `@theokit/skills` reads this file to know what it's generating and where to file it. A
manifest whose `skill` field doesn't match its own directory produces a skill filed under the
wrong name; a manifest that's merely malformed (an empty `teaches`, a `regions` entry missing
`explains`) produces a skill with holes in exactly the fields a reader needs to decide whether to
trust it.

### `package-name`

`package.json`'s `name` field must equal `theokit-example-<directory-slug>` — e.g.
`capabilities/memory/package.json` must declare `"name": "theokit-example-memory"`.

Why: the same predictability as `manifest`, for the file npm actually reads. A name that drifts
from its directory is confusing the moment two examples are open in adjacent terminal tabs.

### `package-fields`

`package.json` must set `"private": true` and `"type": "module"`.

Why: `private: true` stops an example from ever being accidentally published to npm — these are
demonstrations, not packages anyone should `npm install`. `type: module` keeps every example on
the same module system, so a reader moving between examples never has to notice the difference
between `require` and `import`.

### `required-scripts`

`package.json` must define a `start` script and a `typecheck` script, each as a string.

Why: this repository's own README promises `npm install && npm start` runs any example — that
promise only holds if `start` exists. `typecheck` exists because [`strict-typescript`](#strict-typescript)
is enforced on the *configuration*, not by actually invoking the compiler; the `typecheck` script
is what makes that configuration checkable by a human or a CI run, on demand.

### `exact-pin`

Every dependency or devDependency whose name starts with `@theokit/` must be pinned to an exact
version — a bare `major.minor.patch`, optionally with a prerelease suffix (`4.61.0`,
`4.61.0-beta.1`). Ranges (`^4.61.0`, `~4.61.0`), tags (`latest`, `next`), and workspace links are
all rejected.

Why: this repository's README states its central promise in the first paragraph — every example
installs theokit from npm, at a pinned version, exactly as a stranger would. A floating range
means the code a reader is looking at and the code `npm install` actually resolves can silently
diverge between the day the example was written and the day it's read.

### `strict-typescript`

`tsconfig.json` must set `compilerOptions.strict` to `true`.

Why: code inside a region is copied verbatim into a generated skill. Loose type-checking lets
mistakes through that strict mode would catch at edit time — and a mistake that ships in a skill
is a mistake taught to every agent that skill triggers for.

### `gitignore`

`.gitignore` must ignore both `node_modules/` and `dist/`.

Why: neither belongs in version control — one is reinstallable, the other is rebuildable — and an
example that accidentally commits either makes every diff in this repository noisier for everyone
who touches it afterward.

### `region-syntax`

Every `// #region skill:<id>` must be matched by exactly one `// #endregion`, regions must not
nest, and no `#endregion` may appear without an open region.

Why: a region is what gets copied into the generated skill. If the parser can't tell where a
region starts and ends, there is no well-defined text to copy — the ambiguity has to be resolved
by a human before it can be resolved by a machine.

### `region-location`

Every region must be opened inside a file under the example's `src/` directory.

Why: `src/` is the part of an example that is built and type-checked (see `tsconfig.json`'s
`include`). A region opened outside it — in a README code fence, a config file, a script — is
prose or configuration wearing a region marker, not code that was proven to run.

### `region-duplicate`

A region id must appear at most once across all of an example's source files.

Why: `skill.json` maps one id to one body of code. If two files both open a region with the same
id, there is no way to say which body the manifest's `explains` field is describing — the mapping
stops being a mapping.

### `region-missing`

Every region id listed in `skill.json`'s `regions` array must be opened by some file under `src/`.

Why: a manifest entry with no matching region is a promise the code doesn't keep — `skill.json`
says "this example teaches X, here is where," and there is no "here."

### `region-undeclared`

Every region opened under `src/` must have a matching entry in `skill.json`'s `regions` array.

Why: the reverse of `region-missing`. A region nobody declared is either dead — code someone
marked for extraction and then forgot to wire into the manifest — or a sign the manifest is out of
date with the code. Either way, `@theokit/skills` has no `explains` text to generate a skill
section from, so the region would be silently dropped rather than silently included.

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
