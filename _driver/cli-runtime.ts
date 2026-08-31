/**
 * The command runner every example's CLI is built on.
 *
 * THIS FILE IS THE CANONICAL COPY. Each example carries a byte-identical `runtime/cli-runtime.ts`,
 * and `driver-drift` fails the contract check when one of them diverges. To change the runner:
 * edit this file, run `npm run sync`, and commit both.
 *
 * Copied rather than published as a package, because an example that resolves a dependency we
 * invented stops being what a stranger installs. Kept OUTSIDE `src/`, because the skill generator
 * copies `src/` into the skill's `example.md` and these 88 lines of argument parsing teach nothing
 * about the SDK — they would spend an agent's context on scaffolding.
 */

export interface Command {
  /** What follows the command name in the usage line. Empty when it takes no argument. */
  readonly takes: string;
  /** `text` refuses an empty argument; `none` accepts one and may still read it. */
  readonly needs: "text" | "none";
  /** Shown beside the usage line when it is worth knowing before running the command. */
  readonly note?: string;
  readonly run: (input: string) => void | Promise<void>;
}

export interface CliOptions {
  /** One line naming the example, printed above the commands. */
  readonly title: string;
  readonly commands: Record<string, Command>;
  /** Anything a reader needs after the command list — where state lives, which env vars matter. */
  readonly footer?: string;
}

/**
 * Render the usage text FROM the command table, so a documented command and an implemented one
 * cannot drift apart. Writing it by hand is how a usage line outlives the command it described.
 */
export function usage({ title, commands, footer }: CliOptions): string {
  const names = Object.keys(commands);
  const width = Math.max(...names.map((name) => name.length));

  const lines = names.map((name) => {
    const command = commands[name];
    if (command === undefined) return "";
    const call = `  npm start -- ${name.padEnd(width)} ${command.takes}`.trimEnd();
    return command.note === undefined ? call : `${call.padEnd(52)}  ${command.note}`;
  });

  return [`\n${title}\n`, lines.join("\n"), footer === undefined ? "" : `\n${footer}`].join("\n");
}

/**
 * Run one command from `process.argv`, with the four exits the example contract requires:
 * no arguments or `--help` prints usage and exits 0, an unknown command exits 2, a missing
 * required argument exits 2, and a thrown error exits 1 with a hint about credentials.
 *
 * The first of those is what gives CI a smoke test that needs nothing configured.
 */
export async function runCli(options: CliOptions): Promise<void> {
  const [name, ...rest] = process.argv.slice(2);
  const input = rest.join(" ").trim();

  if (name === undefined || name === "--help" || name === "-h") {
    console.log(usage(options));
    return;
  }

  const command = options.commands[name];
  if (command === undefined) {
    console.error(`unknown command: ${name}`);
    console.log(usage(options));
    process.exitCode = 2;
    return;
  }

  if (command.needs === "text" && input.length === 0) {
    console.error(`${name} needs something to say`);
    process.exitCode = 2;
    return;
  }

  try {
    await command.run(input);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nfailed: ${message}`);
    console.error("\nIf this looks like an auth failure, see the README: this example needs a provider credential.");
    process.exitCode = 1;
  }
}
