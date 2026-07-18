import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
} from 'child_process';
import { RootCommand } from '../src/t.js';
import {
  getPackageManagerCommands,
  setupCompletionForPackageManager,
} from './completion-handlers.js';

function debugLog(...args: unknown[]) {
  if (process.env.DEBUG) {
    console.error('[DEBUG]', ...args);
  }
}

const completionSpawnOptions: SpawnSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'ignore'],
  timeout: 1000,
};

export interface DelegatedCompletions {
  delegated: boolean;
  lines: string[];
}

/**
 * Run `<command> [leadingArgs...] complete -- <args>` once and decide, from a
 * single spawn, whether the target behaved like a tab-enabled CLI.
 *
 * A spawn error (e.g. ENOENT when the command isn't on PATH), a non-zero exit,
 * or empty stdout all mean "not a tab-enabled CLI here" — the caller should
 * fall back. A tab-enabled CLI always prints at least the trailing
 * `:<directive>` line, so non-empty stdout on a clean exit is a reliable signal.
 */
function runCompletion(
  command: string,
  leadingArgs: string[],
  completionArgs: string[]
): DelegatedCompletions {
  const result = spawnSync(
    command,
    [...leadingArgs, 'complete', '--', ...completionArgs],
    completionSpawnOptions
  );

  if (result.error) return { delegated: false, lines: [] };
  if (typeof result.status === 'number' && result.status !== 0) {
    return { delegated: false, lines: [] };
  }

  const output = (result.stdout ?? '').trim();
  if (!output) return { delegated: false, lines: [] };

  return { delegated: true, lines: output.split('\n').filter(Boolean) };
}

/**
 * Combined detection + fetch for a delegated CLI, in a single pass:
 *   1. Try the CLI directly (`<cli> complete -- ...`). This is the fast path and
 *      works whenever the CLI is resolvable on PATH.
 *   2. If that fails, fall back to running it through the package manager
 *      (`<pm> <cli> complete -- ...`), which covers local-only installs that are
 *      reachable only via e.g. `pnpm <cli>`.
 *
 * The target CLI is launched at most twice, and only a second time when the
 * direct launch produced nothing.
 */
export function fetchDelegatedCompletions(
  cliName: string,
  packageManager: string,
  args: string[]
): DelegatedCompletions {
  const direct = runCompletion(cliName, [], args);
  if (direct.delegated) return direct;
  return runCompletion(packageManager, [cliName], args);
}

/**
 * Package Manager Completion Wrapper
 *
 * This extends RootCommand and adds package manager-specific logic.
 * It acts as a layer on top of the core tab library.
 */
export class PackageManagerCompletion extends RootCommand {
  private packageManager: string;
  private treeReady = false;

  constructor(packageManager: string) {
    super();
    this.packageManager = packageManager;
  }

  private stripPackageManagerCommands(args: string[]): string[] {
    if (args.length === 0) return args;
    const execCommands = ['exec', 'x', 'run', 'dlx'];
    if (execCommands.includes(args[0])) return args.slice(1);
    return args;
  }

  // Build the package manager's own command tree lazily. This is only needed
  // when we actually complete the package manager itself (super.parse), never
  // on the delegation path.
  private async ensurePackageManagerTree(): Promise<void> {
    if (this.treeReady) return;
    this.treeReady = true;
    await setupCompletionForPackageManager(this.packageManager, this);
  }

  private async getKnownCommandNames(): Promise<Set<string>> {
    // If the full tree is already built, use it; otherwise read just the
    // (cached) command names so we can gate delegation without paying for a
    // `<pm> --help` parse on every keystroke.
    if (this.treeReady) return new Set(this.commands.keys());
    const commands = await getPackageManagerCommands(this.packageManager);
    return new Set(Object.keys(commands));
  }

  private printDelegated(lines: string[]): void {
    debugLog(`Returning ${lines.length} delegated completion lines`);
    for (const line of lines) {
      // The delegated CLI prints its own trailing `:<directive>`; we emit our
      // own below, so drop theirs.
      if (line.startsWith(':')) continue;
      if (line.includes('\t')) {
        const [value, description] = line.split('\t');
        console.log(`${value}\t${description}`);
      } else {
        console.log(line);
      }
    }
    console.log(':4');
  }

  async parse(args: string[]) {
    const normalizedArgs = this.stripPackageManagerCommands(args);

    if (normalizedArgs.length >= 1 && normalizedArgs[0].trim() !== '') {
      const potentialCliName = normalizedArgs[0];
      const knownCommands = await this.getKnownCommandNames();

      // Only a token that is NOT one of the package manager's own commands is a
      // delegation candidate. This keeps package-manager commands (add, install,
      // remove, ...) on the package-manager completion path and avoids ever
      // running e.g. `pnpm add complete -- ...`.
      if (!knownCommands.has(potentialCliName)) {
        const cliArgs = normalizedArgs.slice(1);
        const delegated = fetchDelegatedCompletions(
          potentialCliName,
          this.packageManager,
          cliArgs
        );

        if (delegated.delegated) {
          this.printDelegated(delegated.lines);
          return;
        }
      }
    }

    // Fall back to completing the package manager itself.
    await this.ensurePackageManagerTree();
    return super.parse(args);
  }
}
