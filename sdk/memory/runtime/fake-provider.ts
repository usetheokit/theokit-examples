/**
 * A provider that answers without a network, a key, or a model.
 *
 * THIS FILE IS THE CANONICAL COPY. Each example carries a byte-identical `runtime/fake-provider.ts`,
 * and `driver-drift` fails the contract check when one diverges. Edit here, run `npm run sync`.
 *
 * WHY IT EXISTS. An example that only type-checks proves that the code compiles against the
 * published types — not that it runs. Running it normally costs a provider credential, and a CI job
 * that depends on a secret is a job that stops silently the day the secret rotates. So this repo
 * used to prove the weaker thing.
 *
 * Three of the SDK's 43 providers declare `authType: "none"` and a `localhost` baseUrl. Serving the
 * endpoint ourselves puts a real agent run inside a test: the SDK resolves the provider, opens the
 * transport, streams, and parses, exactly as it would against a hosted model.
 *
 * TWO WIRE PROTOCOLS, because the ecosystem uses both. `lmstudio` (:1234) and `llamacpp` (:8080)
 * request `POST /v1/chat/completions` with SSE frames; `ollama` (:11434) has a dedicated transport
 * and requests `POST /api/chat` with newline-delimited JSON, despite a catalog entry that says
 * `apiMode: "chat_completions"`. Both shapes were measured against @theokit/sdk 4.61.0, and a
 * server offering only the OpenAI path gets `Ollama /api/chat HTTP 404`.
 *
 * WHICH ONE TO PICK. Against the SDK alone, any of the three. Against the `theokit` FRAMEWORK, it
 * must be `ollama`: `@theokit/agents` keeps a registry of its own, far smaller than the SDK's 43,
 * and a model id it does not know is refused before any request leaves the process —
 * `Model "lmstudio/…" declares provider "lmstudio", which is not registered. Registered providers:
 * openrouter, openai, anthropic, ollama.`
 *
 * WHAT IT PROVES, AND WHAT IT DOES NOT. It proves the plumbing — provider resolution, transport,
 * streaming, tool-call round-trips, and everything the framework layers on top. It proves nothing
 * about a model's output, because there is no model: the reply is whatever the test scripted. Any
 * `claims` written against this must say so.
 */

import { createServer, type Server } from "node:http";

/** The credential-free providers, and the wire protocol each one asks for. See the note above. */
export const LOCAL_PROVIDERS = {
  lmstudio: { port: 1234, model: "lmstudio/lmstudio-community/default", wire: "openai" },
  llamacpp: { port: 8080, model: "llamacpp/default", wire: "openai" },
  /** The only one the `theokit` framework will route to. */
  ollama: { port: 11434, model: "ollama/llama3.2", wire: "ollama" },
} as const;

export interface FakeProviderOptions {
  /** Which credential-free provider to impersonate. Defaults to `lmstudio`. */
  readonly provider?: keyof typeof LOCAL_PROVIDERS;
  /**
   * What the assistant says. A string answers every request; a function sees the incoming messages,
   * so a test can assert the agent sent what it was supposed to send.
   */
  readonly reply?: string | ((body: ChatCompletionRequest) => string);
}

export interface ChatCompletionRequest {
  readonly model?: string;
  readonly stream?: boolean;
  readonly messages?: ReadonlyArray<{ readonly role: string; readonly content: unknown }>;
}

export interface FakeProvider {
  /** The model id to hand `Agent.create`, e.g. `lmstudio/lmstudio-community/default`. */
  readonly model: string;
  /** Every request body the SDK sent, in order. What a test asserts against. */
  readonly requests: ReadonlyArray<ChatCompletionRequest>;
  close: () => Promise<void>;
}

/**
 * Start the fake provider and resolve once it is accepting connections.
 *
 * Always `await` the returned `close()` in a `finally`: a listening server keeps the process alive,
 * and a test run that hangs after passing is indistinguishable from one that hung before.
 */
export async function startFakeProvider(options: FakeProviderOptions = {}): Promise<FakeProvider> {
  const { provider = "lmstudio", reply = "ok" } = options;
  const { port, model } = LOCAL_PROVIDERS[provider];
  const requests: ChatCompletionRequest[] = [];

  const server = createServer((request, response) => {
    const path = request.url ?? "";
    const known = path.endsWith("/chat/completions") || path.endsWith("/api/chat");
    if (request.method !== "POST" || !known) {
      response.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      let body: ChatCompletionRequest = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ChatCompletionRequest;
      } catch {
        response.writeHead(400).end();
        return;
      }
      requests.push(body);

      const text = typeof reply === "function" ? reply(body) : reply;
      if (path.endsWith("/api/chat")) ollamaReply(response, body.model ?? model, text);
      else if (body.stream === true) streamReply(response, body.model ?? model, text);
      else sendReply(response, body.model ?? model, text);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      // The port is not a preference. `baseUrl` lives on the provider PROFILE in the SDK's catalog,
      // not on the model selection, so impersonating `ollama` means owning 11434 — there is nowhere
      // else for this server to be. A real Ollama daemon wants the same port, and the two cannot
      // both be "the ollama on this machine".
      //
      // Raw, that collision surfaces as EADDRINUSE from inside a test helper, which reads as a
      // broken suite. It is a machine that is running the demo's server while the proof needs the
      // port.
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `port ${port} is already in use, so the fake ${provider} provider cannot start.\n` +
              `This suite impersonates ${provider}, and a real server is holding that port — most ` +
              `likely the Ollama daemon this repository's examples use for their demo.\n` +
              `Stop it for the test run (\`ollama stop llama3.2\`, or stop the daemon), or run the ` +
              `suite on a machine where it is not listening. The demo and the proof cannot share it.`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", resolve);
  });

  return { model, requests, close: () => closeServer(server) };
}

function sendReply(response: import("node:http").ServerResponse, model: string, text: string): void {
  const payload = {
    id: "chatcmpl-fake",
    object: "chat.completion",
    created: 0,
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload));
}

/** Server-sent events, one delta then `[DONE]` — the shape the chat-completions transport expects. */
function streamReply(response: import("node:http").ServerResponse, model: string, text: string): void {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const frame = (data: unknown) => response.write(`data: ${JSON.stringify(data)}\n\n`);
  const base = { id: "chatcmpl-fake", object: "chat.completion.chunk", created: 0, model };

  frame({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] });
  frame({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
  response.write("data: [DONE]\n\n");
  response.end();
}

/**
 * Ollama's native shape: newline-delimited JSON, one object per line, `done: true` on the last.
 * Not server-sent events, and not wrapped in `choices` — this is a different protocol, not a
 * variation on the one above.
 */
function ollamaReply(response: import("node:http").ServerResponse, model: string, text: string): void {
  response.writeHead(200, { "content-type": "application/x-ndjson" });

  const line = (data: unknown) => response.write(`${JSON.stringify(data)}\n`);
  const at = new Date(0).toISOString();

  line({ model, created_at: at, message: { role: "assistant", content: text }, done: false });
  line({ model, created_at: at, message: { role: "assistant", content: "" }, done: true, done_reason: "stop" });
  response.end();
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.closeAllConnections?.();
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}
