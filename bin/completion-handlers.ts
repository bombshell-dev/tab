import { Completion } from '../src/index.js';
import { execSync } from 'child_process';

const DEBUG = false; // for debugging purposes

function debugLog(...args: any[]) {
  if (DEBUG) {
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
      timeout: 1000, // AMIR: we still havin issues with this, it still hangs if a cli doesn't have completions. longer timeout needed for shell completion system (shell → node → package manager → cli)
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
      timeout: 1000, // same: longer timeout needed for shell completion system (shell → node → package manager → cli)
    });

    const completions = result.trim().split('\n').filter(Boolean);
    debugLog(`Got ${completions.length} completions from ${cliName}`);
    return completions;
  } catch (error) {
    debugLog(`Error getting completions from ${cliName}:`, error);
    return [];
  }
}

export function setupCompletionForPackageManager(
  packageManager: string,
  completion: Completion
) {
  if (packageManager === 'pnpm') {
    setupPnpmCompletions(completion);
  } else if (packageManager === 'npm') {
    setupNpmCompletions(completion);
  } else if (packageManager === 'yarn') {
    setupYarnCompletions(completion);
  } else if (packageManager === 'bun') {
    setupBunCompletions(completion);
  }

  completion.onBeforeParse(async (args: string[]) => {
    debugLog(`onBeforeParse: args =`, args);

    if (args.length >= 1) {
      const potentialCliName = args[0];
      const knownCommands = [...completion.commands.keys()];

      debugLog(
        `Potential CLI: ${potentialCliName}, Known commands:`,
        knownCommands
      );

      if (knownCommands.includes(potentialCliName)) {
        debugLog(`${potentialCliName} is a known command, skipping CLI check`);
        return;
      }

      const hasCompletions = await checkCliHasCompletions(
        potentialCliName,
        packageManager
      );
      if (hasCompletions) {
        debugLog(
          `${potentialCliName} supports completions, getting suggestions`
        );

        const cliArgs = args.slice(1);
        const suggestions = await getCliCompletions(
          potentialCliName,
          packageManager,
          cliArgs
        );

        if (suggestions.length > 0) {
          debugLog(`Processing ${suggestions.length} suggestions`);

          completion.result.suppressDefault = true;

          for (const suggestion of suggestions) {
            if (suggestion.startsWith(':')) {
              debugLog(`Skipping directive: ${suggestion}`);
              continue;
            }

            if (suggestion.includes('\t')) {
              const [value, description] = suggestion.split('\t');
              debugLog(
                `Adding completion with description: ${value} -> ${description}`
              );
              completion.result.items.push({ value, description });
            } else {
              debugLog(`Adding completion without description: ${suggestion}`);
              completion.result.items.push({ value: suggestion });
            }
          }
        } else {
          debugLog(`No suggestions found for ${potentialCliName}`);
        }
      } else {
        debugLog(`${potentialCliName} does not support completions`);
      }
    }
  });
}

export function setupPnpmCompletions(completion: Completion) {
  completion.addCommand('add', 'Install a package', [], async () => []);
  completion.addCommand('remove', 'Remove a package', [], async () => []);
  completion.addCommand(
    'install',
    'Install all dependencies',
    [],
    async () => []
  );
  completion.addCommand('update', 'Update packages', [], async () => []);
  completion.addCommand('exec', 'Execute a command', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('publish', 'Publish package', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}

export function setupNpmCompletions(completion: Completion) {
  completion.addCommand('install', 'Install a package', [], async () => []);
  completion.addCommand('uninstall', 'Uninstall a package', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('publish', 'Publish package', [], async () => []);
  completion.addCommand('update', 'Update packages', [], async () => []);
  completion.addCommand('start', 'Start the application', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}

export function setupYarnCompletions(completion: Completion) {
  completion.addCommand('add', 'Add a package', [], async () => []);
  completion.addCommand('remove', 'Remove a package', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('publish', 'Publish package', [], async () => []);
  completion.addCommand('install', 'Install dependencies', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}

export function setupBunCompletions(completion: Completion) {
  completion.addCommand('add', 'Add a package', [], async () => []);
  completion.addCommand('remove', 'Remove a package', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('install', 'Install dependencies', [], async () => []);
  completion.addCommand('update', 'Update packages', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}
