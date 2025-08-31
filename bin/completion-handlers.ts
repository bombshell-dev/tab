import { PackageManagerCompletion } from './package-manager-completion.js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import type { Complete } from '../src/t.js';

// Helper functions for dynamic completions
function getPackageJsonScripts(): string[] {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return Object.keys(packageJson.scripts || {});
  } catch {
    return [];
  }
}

function getPackageJsonDependencies(): string[] {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    };
    return Object.keys(deps);
  } catch {
    return [];
  }
}

// Common completion handlers
const scriptCompletion = async (complete: Complete) => {
  const scripts = getPackageJsonScripts();
  scripts.forEach((script) => complete(script, `Run ${script} script`));
};

const dependencyCompletion = async (complete: Complete) => {
  const deps = getPackageJsonDependencies();
  deps.forEach((dep) => complete(dep, ''));
};

export async function setupCompletionForPackageManager(
  packageManager: string,
  completion: PackageManagerCompletion
) {
  if (packageManager === 'pnpm') {
    await setupPnpmCompletions(completion);
  } else if (packageManager === 'npm') {
    await setupNpmCompletions(completion);
  } else if (packageManager === 'yarn') {
    await setupYarnCompletions(completion);
  } else if (packageManager === 'bun') {
    await setupBunCompletions(completion);
  }
}

export async function setupPnpmCompletions(
  completion: PackageManagerCompletion
) {
  try {
    const commandsWithDescriptions = await getPnpmCommandsFromMainHelp();

    for (const [command, description] of Object.entries(
      commandsWithDescriptions
    )) {
      const cmd = completion.command(command, description);

      if (['remove', 'rm', 'update', 'up'].includes(command)) {
        cmd.argument('package', dependencyCompletion);
      }
      if (command === 'run') {
        cmd.argument('script', scriptCompletion, true);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to setup pnpm completions:', error.message);
    } else {
      console.error('Failed to setup pnpm completions:', error);
    }
  }
}

async function getPnpmCommandsFromMainHelp(): Promise<Record<string, string>> {
  try {
    const output = execSync('pnpm --help', { encoding: 'utf8', timeout: 3000 });
    const lines = output.split('\n');
    const commands: Record<string, string> = {};

    let inCommandSection = false;
    let currentCommand = '';
    let currentDescription = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.match(
          /^(Manage your dependencies|Review your dependencies|Run your scripts|Other|Manage your store):/
        )
      ) {
        inCommandSection = true;
        continue;
      }

      // exclude options section
      if (line.match(/^Options:/)) {
        break;
      }

      if (inCommandSection && line.trim()) {
        const commandMatch = line.match(/^\s+([a-z,\s-]+?)\s{8,}(.+)$/);
        if (commandMatch) {
          if (currentCommand && currentDescription) {
            const commandNames = currentCommand
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c);
            for (const cmd of commandNames) {
              commands[cmd] = currentDescription.trim();
            }
          }

          const [, cmdPart, description] = commandMatch;
          currentCommand = cmdPart;
          currentDescription = description;

          // sometimes the description is on multiple lines
          let j = i + 1;
          while (j < lines.length && lines[j].match(/^\s{25,}/)) {
            currentDescription += ' ' + lines[j].trim();
            j++;
          }
          i = j - 1;
        }
      }
    }

    if (currentCommand && currentDescription) {
      const commandNames = currentCommand
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);
      for (const cmd of commandNames) {
        commands[cmd] = currentDescription.trim();
      }
    }

    return commands;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to setup pnpm completions:', error.message);
    } else {
      console.error('Failed to setup pnpm completions:', error);
    }
    return {};
  }
}

export async function setupNpmCompletions(
  completion: PackageManagerCompletion
) {}

export async function setupYarnCompletions(
  completion: PackageManagerCompletion
) {}

export async function setupBunCompletions(
  completion: PackageManagerCompletion
) {}
