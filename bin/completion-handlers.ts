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

      // TODO: AMIR: MANUAL OPTIONS ?

      setupLazyOptionLoading(cmd, command);
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

function setupLazyOptionLoading(cmd: any, command: string) {
  cmd._lazyCommand = command;
  cmd._optionsLoaded = false;

  const originalOptions = cmd.options;
  Object.defineProperty(cmd, 'options', {
    get() {
      if (!this._optionsLoaded) {
        this._optionsLoaded = true;
        loadDynamicOptionsSync(this, this._lazyCommand);
      }
      return originalOptions;
    },
    configurable: true,
  });
}

function loadDynamicOptionsSync(cmd: any, command: string) {
  try {
    const output = execSync(`pnpm ${command} --help`, {
      encoding: 'utf8',
      timeout: 3000,
    });
    const lines = output.split('\n');
    let inOptionsSection = false;
    let currentOption = '';
    let currentDescription = '';
    let currentShortFlag: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^Options:/)) {
        inOptionsSection = true;
        continue;
      }

      if (inOptionsSection && line.match(/^[A-Z][a-z].*:/)) {
        break;
      }

      if (inOptionsSection && line.trim()) {
        const optionMatch = line.match(
          /^\s*(?:-([A-Za-z]),\s*)?--([a-z-]+)(?!\s+<|\s+\[)\s+(.*)/
        );
        if (optionMatch) {
          if (currentOption && currentDescription) {
            const existingOption = cmd.options.get(currentOption);
            if (!existingOption) {
              cmd.option(
                currentOption,
                currentDescription.trim(),
                currentShortFlag
              );
            }
          }

          const [, shortFlag, optionName, description] = optionMatch;

          // TODO: AMIR: lets only proccess options that don't have <value> ?
          if (!line.includes('<') && !line.includes('[')) {
            currentOption = optionName;
            currentShortFlag = shortFlag || undefined;
            currentDescription = description;

            let j = i + 1;
            while (
              j < lines.length &&
              lines[j].match(/^\s{25,}/) &&
              !lines[j].match(/^\s*(?:-[A-Za-z],\s*)?--[a-z-]/)
            ) {
              currentDescription += ' ' + lines[j].trim();
              j++;
            }
            i = j - 1;
          } else {
            currentOption = '';
            currentDescription = '';
            currentShortFlag = undefined;
          }
        }
      }
    }

    if (currentOption && currentDescription) {
      const existingOption = cmd.options.get(currentOption);
      if (!existingOption) {
        cmd.option(currentOption, currentDescription.trim(), currentShortFlag);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to load options for ${command}:`, error.message);
    } else {
      console.error(`Failed to load options for ${command}:`, error);
    }
  }
}
