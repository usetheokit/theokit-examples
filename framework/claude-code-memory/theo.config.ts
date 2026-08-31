import { config } from "theokit";

/**
 * The whole configuration. Routing, the agent mount and the security defaults need no entry — and
 * neither does memory: `.memory(...)` lives on the agent that uses it, in `agents/remember.ts`,
 * not in a central registry. An app-wide memory block here would make the store a property of the
 * deployment rather than of the agent, and one agent remembering while another does not is the
 * ordinary case.
 *
 * The file is required even when it is empty: `theokit dev` refuses to start without it
 * ("Invalid Theo project structure — Missing required file: theo.config.ts").
 */
export default config().build();
