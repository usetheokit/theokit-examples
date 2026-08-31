# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **The conformance pair — `sdk/claude-code-memory` and `framework/claude-code-memory`.** Both ask
  whether what this ecosystem writes to disk is what the Claude Code CLI writes, and neither answers
  from the documentation: the SDK half diffs against a RECORDING taken from a live `claude 2.1.236`
  session, and the framework half writes its store through a real `theokit dev` server.
- **The recording is refreshable and says which version it came from.** `npm start -- oracle` drives
  a real session in tmux from a NESTED subdirectory — running from the repo root makes cwd-keying and
  git-root-keying indistinguishable, which is what made the first answer wrong. It is a command and
  not a test because it needs a credential, and a test that skips itself when the CLI is absent
  reports green on every machine that cannot run it.
- **Three divergences are asserted, not zero.** A test claiming conformance would have been a wish,
  red from the day it was written. The suite pins the index heading, the missing `originSessionId`
  and the extra `observations`, so each one has to be updated deliberately when the SDK moves.
- **`theokit-sdk#479`, found by the pair and pinned by it.** The SDK reads the Claude Code store
  keyed by `cwd`; the CLI writes it keyed by the GIT ROOT. Two real sessions from subdirectories both
  put the memory on the repo root. An agent below the root reads a directory the CLI never wrote to,
  finds nothing, and reports nothing.
- **The framework half found who actually decides classification.** `metadata.type` is written only
  when the message declares a kind — `Remember (project): …` produces it, `Remember: …` does not, and
  both are stored. In a served app the caller composes that message, so a UI sending the bare form
  produces memories the CLI can read and cannot categorise. The layer changes nothing; the text does.

- **`framework/memory` — the other half of the pair.** `sdk/memory` proves memory survives between
  two PROCESSES; this proves it between two HTTP REQUESTS, which is the shape a served agent
  actually meets. It closes `theokit#557`: `.memory({ directory })` is forwarded to the SDK and
  honoured, so an app can say where its store lives and be obeyed. The example pins
  `@theokit/sdk@4.63.0` because an earlier pin would make its central lesson false.
- **The proof is stronger than the SDK half's, because the provider is fake.** A stub records every
  request body the SDK sent, so the suite asserts on the PROMPT rather than on a reply: a fact
  learned in one request appearing in the next request's messages proves recall crossed the
  boundary, deterministically and with no credential. It also asserts the SDK's default store
  stayed EMPTY — without that half, "a file appeared where I asked" would still pass if the store
  had merely been duplicated.
- **`llms.txt` — the index an agent fetches before it opens anything.** Generated from the
  examples on disk by `npm run index`, never written by hand, and checked by `index-stale`, which
  treats an absent index as a stale one. A summary that can disagree with what it summarises is
  worse than none: a reader stops at the summary, so a wrong one reports absence where an example
  exists.
- **`scripts/check-structure.mjs` — the checks that live BETWEEN examples.** The skills checker
  validates each example against the contract; nothing asked the questions that only make sense
  across the corpus. Three now do: `readme-format`, `index-stale`, `dangling-neighbour`. It does
  not repeat a single check the skills checker already runs.
- **`dangling-neighbour` found one on its first run.** `sdk/memory` declares
  `seeAlso: ["theokit-framework-memory"]` — the framework half of the pair, which nobody has
  written. The contract already said why that matters (*"an agent that cannot reach the adjacent
  skill writes the adjacent code from memory"*) and nothing enforced it, so the corpus was
  declaring a reading order it could not walk.

### Changed

- **Both READMEs now open the way agent-facing documentation opens**: an index pointer, a title
  phrased as what the reader will be able to do, and one blockquote line that works with no
  context around it. The reader is usually an agent and usually arrives in the middle, so the
  first thing on the page is where the other examples are. Enforced by `readme-format`.
- **Both examples pin `@theokit/sdk@4.63.0`** and install it fresh from the registry: 6/6 in
  `sdk/memory`, typecheck clean in both. The version numbers inside the prose were left alone —
  they record what was measured against which release, and bumping a measurement's version
  fabricates a measurement nobody ran.

- The release gate is written down in the README instead of living in an agreement between
  sessions: `cd framework/agent-endpoint && npm test` before cutting a release, ~40s, no credential.
  An arrangement held in someone's head is a step that stops happening the first week nobody
  remembers it — and the two people who agreed to this one are conversations, not roles.
- `framework/agent-endpoint` gains a second agent, `agents/declared-provider.ts`, and the lesson
  `variant-declared-provider`. It proves theokit#579 from the consumer side: declaring the SDK
  catalog with `.plugins(Provider.builtins())` makes a prefix routable that the first agent cannot
  reach — and it does that by being a second file, which is the example's own core lesson applied
  to itself.


- **`framework/agent-endpoint` — the first example of the framework itself.** `agents/chat.ts` is
  served at `POST /api/agents/chat` and nothing registers it; the test starts the real
  `theokit dev` and proves that over HTTP, with no credential. The 404 assertion is what makes the
  200 mean something: an unnamed agent must be refused, or "the agent answered" would also pass on
  a server that answers everything. It also pins down two things that stop a correct-looking call:
  a request without `X-Theo-Action` is 403 `CSRF_FAILED`, and the framework routes to four
  providers where the SDK catalogs 43.
- The `framework` anatomy, written from the example rather than before it: `runtime/fake-provider.ts`
  is required and `cli-runtime.ts` is not, lessons about pitfalls live under a reserved folder like
  `agents/lib/` because a bare `agents/pitfalls.ts` would become a route, and `npm test` is the
  credential-free proof in place of the driver's four exits.
- The fake provider speaks **two** wire protocols. `lmstudio` and `llamacpp` want
  `POST /v1/chat/completions` with SSE; `ollama` wants `POST /api/chat` with newline-delimited
  JSON. The framework only routes to the second of those, so an example that runs inside a theokit
  app has to use it.
- **Every lesson is now proven by an executable test, with no credential anywhere.**
  `_driver/fake-provider.ts` serves the chat-completions protocol on a credential-free provider's
  port, so a real agent run fits inside `npm test`: the SDK resolves the provider, opens the
  transport, streams and parses. `sdk/memory` ships six such tests, one per lesson plus one
  for the example's whole thesis — a second agent, created from scratch, is handed what the first
  one learned. The new `proof` rule fails any example whose lessons no test names.
- `_driver/cli-runtime.ts`, the command runner every example's CLI is built on, copied into each
  example as `runtime/cli-runtime.ts` — **outside `src/`**, because the skill generator copies
  `src/` into the skill's `example.md` and 88 lines of argument parsing would spend an agent's
  context on scaffolding. It also keeps two files named `cli*` out of one directory listing. Plus
  `npm run new -- <category>/<slug>` to scaffold an example and `npm run sync` to push a runner fix
  into every one of them. The runner is **copied** into each example rather than imported: the
  driver ships whole inside the generated skill, and an import of a package we invented would hand
  the reader a framework their project does not have. Copying is kept honest by the new
  `driver-drift` check rather than by discipline — forty-five hand-copied runners would otherwise
  become forty-five places to fix one bug.
- A fixed anatomy for every example outside the `framework` category: a driver that opens no
  lesson, `minimal.ts` for the smallest thing that works, the domain file, and `pitfalls.ts` for
  the mistakes. Lesson ids now carry their role in the prefix (`minimal`, `setup-*`, `core-*`,
  `variant-*`, `pitfall-*`, `verify-*`). Fifty examples in fifty shapes would cost a reader the
  layout in each one; the uniformity is what lets an agent spend its attention on the domain.
- A `framework` category, for examples that teach the theokit framework itself. Its own anatomy is
  deliberately unwritten until the first such example exists — a whole app is not a single-process
  `src/`, and a rule invented for a case nobody has built is a rule that has never been wrong.
- `seeAlso` and `requires` in `skill.json`, both optional: the neighbouring domains and the
  conceptual prerequisites. An agent that cannot reach the adjacent skill writes the adjacent code
  from memory, which is the failure this repository exists to prevent.
- `sdk/memory` ships three new commands. `pitfall:permissions` needs no credential:
  it constructs `PermissionEngine` both ways and prints the resulting `rules` field.

### Changed

- `framework/agent-endpoint` is pinned to `theokit@0.62.1` and `@theokit/sdk@4.62.0` (was 0.59.0 /
  4.61.0). Every assertion passed unchanged across both bumps, which is the answer to "did the
  release rot the example" that no typecheck can give. This is now a standing arrangement: the
  framework session runs this example's `npm test` before cutting a release, and a failure is a
  block rather than a footnote.
- The test needs **no credential at all** again. Between 0.62.0 and 0.62.1 it carried a
  `LMSTUDIO_API_KEY` whose value authenticated nothing, present only to satisfy a gate that read
  "has a named env var" as "needs a credential"
  ([theokit#585](https://github.com/usetheokit/theokit/issues/585), a regression this example
  found and whose fix it then verified). Removed.


- **BREAKING: examples are now `<layer>/<domain>`, one axis per level.** The layer is a closed
  vocabulary naming the package an example teaches — `sdk`, `framework`, `ui`, `tui`, `di`,
  `plugins`, `gateways` — and the domain is the directory under it. `capabilities/memory` is
  `sdk/memory`, and its skill is `theokit-sdk-memory`.

  The old vocabulary mixed two axes: `capabilities` and `connections` were domains *of the SDK*,
  while `component-libraries` and `backend-di` were layers. So `capabilities/` meant "SDK" by
  accident, "memory, but in the framework" had nowhere to go, and the name `theokit-memory` was
  already spent on one of the two sides.

  **A pair now needs no declaration.** `sdk/memory` and `framework/memory` are the same capability
  proved on both sides — same domain, different layer — and that is exactly the comparison that
  surfaced [theokit#557](https://github.com/usetheokit/theokit/issues/557). The skill and package
  names carry the layer (`theokit-sdk-memory`, `theokit-example-sdk-memory`) so the two sides of a
  pair cannot collide, and so an agent reading a skill name knows which API it is about to get.
- `sdk/memory`'s driver is now a command table plus a call to `runCli`, with the usage
  text derived from the table — so a usage line cannot describe a command that no longer exists,
  and the duplicated "needs an argument" check inside the file is gone.
- `sdk/memory` migrated to the new anatomy. `assistant.ts` became `memory.ts`, its two
  lessons were renamed to declare their role, and the two pitfalls moved into `pitfalls.ts` as
  runnable demonstrations rather than prose.
- **BREAKING: `region` is now `lesson`.** Markers read `// #region lesson:<id>` and `skill.json`
  declares `lessons`. The old name said where the block was; a lesson is what it is for, which is
  what `explains` describes and what the array order already meant. The editor's `#region` syntax
  stays, so the block still folds — only the namespace changed.
- Lessons may now live under any directory `tsconfig.json` includes, not only `src/`. A framework
  example has `app/`, `agents/` and `server/` and no `src/` at all.

- `runtime/cli-runtime.ts` joins the fixed anatomy as a fourth fixed file, outside `src/`. It opens
  no lesson, for the same reason the driver does not. `tsconfig.json` gains
  `include: ["src", "runtime"]` and `rootDir: "."` so the runner is still type-checked.
- The driver's behaviour is now contract: no arguments or `--help` prints usage and exits 0, an
  unknown command exits 2, a missing required argument exits 2, and none of the three needs a
  credential. Written down because the first row is the smoke test CI can run with nothing
  configured.

### Fixed

- The `pitfall-provider-registry` lesson said the framework "registers four providers where the SDK
  catalogs 43". That framing stopped being true with theokit#579 — the count was never the rule;
  **declaration** is. The lesson now says the framework refuses a provider the app never named, and
  carries the remedy.


- The provider to impersonate is `lmstudio` or `llamacpp`, not `ollama`. Ollama's catalog entry says
  `apiMode: "chat_completions"` and looks like the obvious choice, but measured against
  `@theokit/sdk` 4.61.0 it has a dedicated transport that requests `POST /api/chat` — a server
  offering only `/v1/chat/completions` gets `Ollama /api/chat HTTP 404`. The other two were measured
  the same way and do request the OpenAI path.
- Ecosystem dependencies that escaped `exact-pin`: `theokit`, `create-theokit` and `@usetheo/*` are
  now pinned exactly like `@theokit/*`. The framework package has no scope, so the old prefix test
  did not see it.

- The claim that `new PermissionEngine({ rules: [] })` produces a crash. Measured against
  `@theokit/sdk` 4.61.0 by `npm start -- pitfall:permissions`: it does not throw. It stores the
  whole options object in the field meant to hold the array, so no rule can ever match — a silent
  no-op wearing the shape of a configured gate, which is worse than the crash we described. The
  README, `verify-permissions.ts` and the manifest's evidence all said "crash" and now say what
  was measured.
