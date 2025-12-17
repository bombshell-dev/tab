import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
} from 'child_process';
import path from 'node:path';
import { RootCommand } from '../src/t.js';

const noop = () => {};

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

function runCompletionCommand(
  command: string,
  leadingArgs: string[],
  completionArgs: string[]
): string {
  const args = [...leadingArgs, 'complete', '--', ...completionArgs];

  const result = spawnSync(command, args, completionSpawnOptions);

  // Windows: npm may only produce a .ps1 shim; spawnSync won't resolve .ps1 via PATHEXT.
  // Fallback: invoke through PowerShell so .ps1 shims (e.g. nuxt.ps1) are discoverable.
  // TODO(AMIR): This is a hack to get the completion working on Windows.
  // We should find a better way to do this. as this is not a good solution. and slows down the completion.
  if (
    result.error &&
    (result.error as { code?: string }).code === 'ENOENT' &&
    process.platform === 'win32' &&
    path.extname(command) === ''
  ) {
    const psArgs = args.map(powerShellQuote);
    const psCommand = `& ${command} ${psArgs.join(' ')}`.trimEnd();

    const psResult = spawnSync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        psCommand,
      ],
      completionSpawnOptions
    );

    if (psResult.error) {
      throw psResult.error;
    }
    if (typeof psResult.status === 'number' && psResult.status !== 0) {
      throw new Error(
        `Completion command "${command}" (PowerShell fallback) exited with code ${psResult.status}`
      );
    }
    return (psResult.stdout ?? '').trim();
  }

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(
      `Completion command "${command}" exited with code ${result.status}`
    );
  }

  return (result.stdout ?? '').trim();
}

function powerShellQuote(value: string): string {
  // Use single quotes and escape embedded single quotes by doubling them.
  return `'${value.replace(/'/g, "''")}'`;
}

async function checkCliHasCompletions(
  cliName: string,
  packageManager: string
): Promise<boolean> {
  try {
    const result = runCompletionCommand(cliName, [], []);
    if (result) return true;
  } catch {
    noop();
  }

  try {
    const result = runCompletionCommand(packageManager, [cliName], []);
    return !!result;
  } catch {
    return false;
  }
}

async function getCliCompletions(
  cliName: string,
  packageManager: string,
  args: string[]
): Promise<string[]> {
  try {
    const result = runCompletionCommand(cliName, [], args);
    if (result) {
      return result.split('\n').filter(Boolean);
    }
  } catch {
    noop();
  }

  try {
    const result = runCompletionCommand(packageManager, [cliName], args);
    return result.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Package Manager Completion Wrapper
 *
 * This extends RootCommand and adds package manager-specific logic.
 * It acts as a layer on top of the core tab library.
 */
export class PackageManagerCompletion extends RootCommand {
  private packageManager: string;

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

  async parse(args: string[]) {
    const normalizedArgs = this.stripPackageManagerCommands(args);

    if (normalizedArgs.length >= 1 && normalizedArgs[0].trim() !== '') {
      const potentialCliName = normalizedArgs[0];
      const knownCommands = [...this.commands.keys()];

      if (!knownCommands.includes(potentialCliName)) {
        const hasCompletions = await checkCliHasCompletions(
          potentialCliName,
          this.packageManager
        );

        if (hasCompletions) {
          const cliArgs = normalizedArgs.slice(1);
          const suggestions = await getCliCompletions(
            potentialCliName,
            this.packageManager,
            cliArgs
          );

          if (suggestions.length > 0) {
            debugLog(
              `Returning ${suggestions.length} completions for ${potentialCliName}`
            );
            for (const suggestion of suggestions) {
              if (suggestion.startsWith(':')) continue;
              if (suggestion.includes('\t')) {
                const [value, description] = suggestion.split('\t');
                console.log(`${value}\t${description}`);
              } else {
                console.log(suggestion);
              }
            }
            console.log(':4');
            return;
          }
        }
      }
    }

    return super.parse(args);
  }
}
