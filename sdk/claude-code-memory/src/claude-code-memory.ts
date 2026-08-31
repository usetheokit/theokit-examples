import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// #region lesson:core-describe-a-store
/**
 * What a memory store looks like, reduced to the parts two implementations can disagree about.
 *
 * Comparing directories byte for byte would report every difference — the slugs, the prose, the
 * timestamps — and drown the four that matter. This describes SHAPE: which files exist, what the
 * index looks like, and which frontmatter keys each memory carries.
 */
export interface StoreShape {
  /** `MEMORY.md` plus one file per memory, sorted. */
  readonly files: readonly string[];
  /** Whether `MEMORY.md` opens with a markdown heading before its entries. */
  readonly indexHasHeading: boolean;
  /** Index entries, parsed from `- [Title](file.md) — hook`. */
  readonly indexEntries: readonly { readonly title: string; readonly target: string }[];
  /** Frontmatter keys seen across every memory file, as `metadata.` paths where nested. */
  readonly frontmatterKeys: readonly string[];
}

/**
 * Read a memory directory and describe it.
 *
 * Deliberately tolerant: a directory that does not exist describes as empty rather than throwing,
 * because "the store is not where I looked" is a result this example needs to be able to report.
 */
export async function describeStore(memoryDir: string): Promise<StoreShape> {
  const names = (await readdir(memoryDir).catch(() => [] as string[]))
    .filter((n) => n.endsWith(".md"))
    .sort();

  const index = await readFile(join(memoryDir, "MEMORY.md"), "utf8").catch(() => "");
  const lines = index.split("\n");

  const keys = new Set<string>();
  for (const name of names) {
    if (name === "MEMORY.md") continue;
    const body = await readFile(join(memoryDir, name), "utf8").catch(() => "");
    for (const key of frontmatterKeys(body)) keys.add(key);
  }

  return {
    files: names,
    indexHasHeading: lines.some((l) => l.startsWith("#")),
    indexEntries: lines.flatMap((line) => {
      const m = /^-\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line);
      return m === null ? [] : [{ title: m[1] ?? "", target: m[2] ?? "" }];
    }),
    frontmatterKeys: [...keys].sort(),
  };
}

/** Keys of a YAML frontmatter block, one level of nesting flattened to `parent.child`. */
function frontmatterKeys(body: string): string[] {
  if (!body.startsWith("---\n")) return [];
  const end = body.indexOf("\n---", 4);
  if (end === -1) return [];
  const keys: string[] = [];
  let parent = "";
  for (const line of body.slice(4, end).split("\n")) {
    const top = /^([a-zA-Z_][\w-]*):/.exec(line);
    if (top !== null) {
      parent = top[1] ?? "";
      keys.push(parent);
      continue;
    }
    const nested = /^\s+([a-zA-Z_][\w-]*):/.exec(line);
    if (nested !== null && parent !== "") keys.push(`${parent}.${nested[1]}`);
  }
  return keys;
}
// #endregion

// #region lesson:core-the-recorded-oracle
/**
 * WHAT THE CLAUDE CODE CLI ACTUALLY WROTE — recorded, not described from documentation.
 *
 * Captured on 2026-08-31 from `claude 2.1.236`, driven in a tmux session against a fresh git repo,
 * asked to remember two facts. `npm start -- oracle` re-runs that capture; it needs a logged-in
 * CLI, which is why it is a command and not part of `npm test`.
 *
 * Recording it matters more than it looks. The alternative is asserting against the documentation,
 * and the documentation is what a reader can already check — what nobody can check without a real
 * session is whether the running CLI still does what the page says.
 */
export const CLAUDE_CODE_LAYOUT = {
  capturedFrom: "claude 2.1.236",
  capturedOn: "2026-08-31",
  /** No heading. The file opens on its first entry. */
  indexHasHeading: false,
  /** `- [Title](slug.md) — hook`, one line per memory. */
  indexEntryShape: /^-\s+\[[^\]]+\]\([^)]+\.md\)\s+—\s+\S/,
  frontmatterKeys: [
    "description",
    "metadata",
    "metadata.modified",
    "metadata.node_type",
    "metadata.originSessionId",
    "metadata.type",
    "name",
  ],
} as const;

/**
 * Where the SDK and the CLI differ, as a list rather than a boolean.
 *
 * A conformance check that answers yes/no is a check nobody can act on: the interesting output is
 * WHICH properties diverge, because they carry different costs and some are deliberate.
 */
export function divergencesFromClaudeCode(shape: StoreShape): string[] {
  const found: string[] = [];

  if (shape.indexHasHeading !== CLAUDE_CODE_LAYOUT.indexHasHeading) {
    found.push(
      `MEMORY.md opens with a heading; the CLI's does not (costs two of the 200 lines it loads)`,
    );
  }

  const ours = new Set(shape.frontmatterKeys);
  for (const key of CLAUDE_CODE_LAYOUT.frontmatterKeys) {
    if (!ours.has(key)) found.push(`frontmatter is missing \`${key}\`, which the CLI writes`);
  }
  for (const key of shape.frontmatterKeys) {
    if (!CLAUDE_CODE_LAYOUT.frontmatterKeys.includes(key as never)) {
      found.push(`frontmatter carries \`${key}\`, which the CLI does not write`);
    }
  }

  return found;
}
// #endregion
