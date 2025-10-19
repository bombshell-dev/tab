import { execSync } from 'child_process';
import { RootCommand } from '../src/t.js';

function debugLog(...args: any[]) {
  if (process.env.DEBUG) {
    console.error('[DEBUG]', ...args);
  }
}

async function checkCliHasCompletions(
  cliName: string,
  packageManager: string
): Promise<boolean> {
  try {
    const result = execSync(`${cliName} complete --`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000,
    });
    if (result.trim()) return true;
  } catch { }

  try {
    const result = execSync(`${packageManager} ${cliName} complete --`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000,
    });
    return !!result.trim();
  } catch {
    return false;
  }
}

async function getCliCompletions(
  cliName: string,
  packageManager: string,
  args: string[]
): Promise<string[]> {
  const completeArgs = args.map((arg) =>
    arg.includes(' ') ? `"${arg}"` : arg
  );

  try {
    const result = execSync(`${cliName} complete -- ${completeArgs.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000,
    });
    if (result.trim()) {
      return result.trim().split('\n').filter(Boolean);
    }
  } catch { }

  try {
    const result = execSync(`${packageManager} ${cliName} complete -- ${completeArgs.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000,
    });
    return result.trim().split('\n').filter(Boolean);
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
            debugLog(`Returning ${suggestions.length} completions for ${potentialCliName}`);
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
