import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// #region lesson:variant-recapture-the-oracle
/**
 * Re-take the recording, by driving a REAL Claude Code session.
 *
 * This is the step nothing else in the repository does: every other example proves the SDK against
 * the SDK. Here the CLI is the authority, so the only honest way to learn what it writes is to make
 * it write something and look.
 *
 * It is a command rather than a test on purpose. It needs a logged-in `claude` on PATH, it spends
 * the operator's tokens, and it takes a couple of minutes — three properties that would make the
 * suite unrunnable for anyone else. `npm test` asserts against the RECORDING; this refreshes it.
 *
 * The session runs from a nested subdirectory of a fresh repo, which is not incidental: that is the
 * shape that separates cwd-keying from git-root-keying, and running from the repo root would make
 * the two indistinguishable and the capture worthless.
 */
export async function captureFromRealSession(): Promise<{
  projectDirsCreated: string[];
  whereMemoryLanded: string | null;
  files: string[];
}> {
  const repo = await mkdtemp(join(tmpdir(), "theokit-oracle-"));
  const nested = join(repo, "nested", "deep");

  try {
    await run("mkdir", ["-p", nested]);
    await run("git", ["init", "-q"], { cwd: repo });
    await run("git", ["-c", "user.email=o@x", "-c", "user.name=o", "commit", "-q", "--allow-empty", "-m", "init"], { cwd: repo });

    const session = `oracle-${Date.now()}`;
    await run("tmux", ["new-session", "-d", "-s", session, "-x", "200", "-y", "50", "-c", nested, "claude --permission-mode acceptEdits"]);
    await wait(28_000);
    await run("tmux", ["send-keys", "-t", session, "Enter"]);           // trust the folder
    await wait(15_000);
    await run("tmux", ["send-keys", "-t", session, ORACLE_PROMPT]);
    await run("tmux", ["send-keys", "-t", session, "Enter"]);
    await wait(80_000);
    await run("tmux", ["kill-session", "-t", session]).catch(() => undefined);

    const projects = join(homedir(), ".claude", "projects");
    const encoded = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "-");
    const candidates = [repo, join(repo, "nested"), nested].map(encoded);

    const created: string[] = [];
    let landed: string | null = null;
    let files: string[] = [];

    for (const dir of candidates) {
      const memory = join(projects, dir, "memory");
      const found = (await readdir(memory).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));
      if (await exists(join(projects, dir))) created.push(dir);
      if (found.length > 0) {
        landed = dir;
        files = found.sort();
      }
    }

    return { projectDirsCreated: created, whereMemoryLanded: landed, files };
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
}

/** Explicit, because auto memory saves what the user asks it to and nothing else. */
const ORACLE_PROMPT =
  "Remember for future sessions: this probe repo pins vitest at 1.2.3 and never uses jest.";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const exists = (p: string) => readFile(p).then(() => true).catch(() => readdir(p).then(() => true).catch(() => false));
// #endregion
