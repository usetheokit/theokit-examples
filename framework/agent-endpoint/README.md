> ## Documentation Index
> Fetch the complete example index at: llms.txt (this repository's root)
> Use this file to discover all available examples before exploring further.

# How a file becomes an HTTP route

> Serve an agent by creating a file — its path is the route, and nothing registers it.

`agents/chat.ts` is served at `POST /api/agents/chat`. There is no router, no handler, and no
config entry: the file's location IS the declaration, and the framework compiles it into a route
at start-up.

This page covers how to:

* [See the proof](#what-npm-test-actually-does) — a real server, a real agent, no credential
* [Avoid two failures](#two-things-that-will-bite-you) that look like a broken agent and are not
* [Know what is out of scope](#what-this-does-not-teach) before you go looking for it

```sh
npm install
npm test          # proves it, with no credential

npm run dev       # http://localhost:3000
```

Pinned to `theokit@0.63.0` and `@theokit/sdk@4.63.0` — the versions published today.

## What `npm test` actually does

It starts the real `theokit dev` and talks to it over HTTP, with `LLM_MODEL` pointed at a local
stub that speaks Ollama's wire protocol. The routing, the agent compilation, the SDK and the
streaming are all real; only the model at the far end is replaced.

| Assertion | What it proves |
|---|---|
| `POST /api/agents/definitely-not-an-agent` → 404 | that a 404 is reachable at all — without this, the next line proves nothing |
| `POST /api/agents/chat` → 200, carrying the stub's text | the file became the route, the agent ran, the stream came back |
| a body that does not match `.input()` → refused, provider never called | validation happens before the agent, not inside it |
| no `X-Theo-Action` header → 403 `CSRF_FAILED` | a state-changing route is protected by default |
| an undeclared provider prefix → refused | the framework will not route a provider the app never named |
| a second agent declaring `Provider.builtins()` → 200 | declaring the catalog is what makes a prefix routable, and a second agent is a second file |

## Two things that will bite you

**The CSRF header.** `useAgent` and the typed client send `X-Theo-Action` for you. A hand-built
`fetch`, a curl or a test must send it, or the answer is `403 CSRF_FAILED` — which reads like a
broken agent and is a request that never reached one.

**The provider registry.** The framework will not route a model id whose provider the app never
named, so a prefix that works in a standalone SDK script is refused before any request leaves the
process. The way out is to declare the catalog — `.plugins(Provider.builtins())`, as
`agents/declared-provider.ts` does.

A keyless provider then needs no key — `lmstudio` and `llamacpp` are `authType: "none"` in that
catalog, and this example's test reaches them with no credential set at all. That was briefly
untrue: on 0.62.0 the credential gate read "has a named env var" as "needs a credential", so any
string satisfied it. Fixed in 0.62.1 ([theokit#585](https://github.com/usetheokit/theokit/issues/585)).

## What this does not teach

The React side (`useAgent`, the chat UI), tools and approvals on the agent, and the rest of the
framework's surface — `server/routes`, WebSocket, cron, auth. `app/page.tsx` exists only because
the framework requires an `app/` directory; it is not the lesson.
