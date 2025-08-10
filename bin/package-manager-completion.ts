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
    debugLog(`Checking if ${cliName} has completions via ${packageManager}`);
    const command = `${packageManager} ${cliName} complete --`;
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000,
    });
    const hasCompletions = !!result.trim();
    debugLog(`${cliName} supports completions: ${hasCompletions}`);
    return hasCompletions;
  } catch (error) {
    debugLog(`Error checking completions for ${cliName}:`, error);
    return false;
  }
}

async function getCliCompletions(
  cliName: string,
  packageManager: string,
  args: string[]
): Promise<string[]> {
  try {
    const completeArgs = args.map((arg) =>
      arg.includes(' ') ? `"${arg}"` : arg
    );
    const completeCommand = `${packageManager} ${cliName} complete -- ${completeArgs.join(' ')}`;
    debugLog(`Getting completions with command: ${completeCommand}`);

    const result = execSync(completeCommand, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000,
    });

    const completions = result.trim().split('\n').filter(Boolean);
    debugLog(`Got ${completions.length} completions from ${cliName}`);
    return completions;
  } catch (error) {
    debugLog(`Error getting completions from ${cliName}:`, error);
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

  // Enhanced parse method with package manager logic
  async parse(args: string[]) {
    // Handle package manager completions first
    if (args.length >= 1 && args[0].trim() !== '') {
      const potentialCliName = args[0];
      const knownCommands = [...this.commands.keys()];

      if (!knownCommands.includes(potentialCliName)) {
        const hasCompletions = await checkCliHasCompletions(
          potentialCliName,
          this.packageManager
        );

        if (hasCompletions) {
          const cliArgs = args.slice(1);
          const suggestions = await getCliCompletions(
            potentialCliName,
            this.packageManager,
            cliArgs
          );

          if (suggestions.length > 0) {
            // Print completions directly in the same format as the core library
            for (const suggestion of suggestions) {
              if (suggestion.startsWith(':')) continue;

              if (suggestion.includes('\t')) {
                const [value, description] = suggestion.split('\t');
                console.log(`${value}\t${description}`);
              } else {
                console.log(suggestion);
              }
            }
            console.log(':4'); // Shell completion directive (NoFileComp)
            return;
          }
        }
      }
    }

    // Fall back to regular completion logic (shows basic package manager commands)
    return super.parse(args);
  }
}
