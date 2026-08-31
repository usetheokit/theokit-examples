/**
 * The framework requires an `app/` directory — routing and the agent mount are one project, not
 * two. This example is about the endpoint, so the page is the smallest thing that satisfies that:
 * `app/page.tsx` is `/`, the same way `agents/chat.ts` is `POST /api/agents/chat`.
 *
 * The browser side of the story — `useAgent('/api/agents/chat')` rendering the stream — is
 * deliberately out of scope here; see `notCovered` in skill.json.
 */
export default function Page() {
  return <p>The agent is at POST /api/agents/chat.</p>;
}
