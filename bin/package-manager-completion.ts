import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
} from 'child_process';
import { RootCommand } from '../src/t.js';

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
  const result = spawnSync(
    command,
    [...leadingArgs, 'complete', '--', ...completionArgs],
    completionSpawnOptions
  );

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

async function checkCliHasCompletions(
  cliName: string,
  packageManager: string
): Promise<boolean> {
  try {
    const result = runCompletionCommand(cliName, [], []);
    if (result) return true;
  } catch {}

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
  } catch {}

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
