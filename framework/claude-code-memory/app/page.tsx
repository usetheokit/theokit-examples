/**
 * The framework requires an `app/` directory. This example is about what a served agent writes to
 * disk, so the page is the smallest thing that satisfies the requirement.
 */
export default function Page() {
  return <p>POST /api/agents/remember, then read the store.</p>;
}
