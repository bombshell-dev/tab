import { promisify } from 'node:util';
import child_process from 'node:child_process';

const exec = promisify(child_process.exec);
const { execSync } = child_process;

import type { PackageManagerCompletion } from '../package-manager-completion.js';
import { Command, Option } from '../../src/t.js';
import {
  packageJsonScriptCompletion,
  packageJsonDependencyCompletion,
} from '../completions/completion-producers.js';
import { getWorkspacePatterns } from '../utils/filesystem-utils.js';
import { stripAnsiEscapes, type ParsedOption } from '../utils/text-utils.js';

interface LazyCommand extends Command {
  _lazyCommand?: string;
  _optionsLoaded?: boolean;
  optionsRaw?: Map<string, Option>;
}

// regex patterns to avoid recompilation in loops
const ALL_COMMANDS_RE = /^All commands:\s*$/i;
const OPTIONS_SECTION_RE = /^Options:\s*$/i;
const SECTION_END_RE = /^(aliases|run|more)/i;
const COMMAND_VALIDATION_RE = /^[a-z][a-z0-9-]*$/;
const NPM_OPTION_RE =
  /(?:\[)?(?:-([a-z])\|)?--([a-z][a-z0-9-]+)(?:\s+<[^>]+>)?(?:\])?/gi;
const OPTION_VALUE_RE = /<[^>]+>/;
const NON_INDENTED_LINE_RE = /^\s/;

// completion handlers for npm options that take values
const npmOptionHandlers = {
  loglevel: function (complete: (value: string, description: string) => void) {
    // npm log levels from documentation
    [
      'silent',
      'error',
      'warn',
      'notice',
      'http',
      'info',
      'verbose',
      'silly',
    ].forEach((level) => complete(level, `Log level: ${level}`));
  },

  registry: function (complete: (value: string, description: string) => void) {
    complete('https://registry.npmjs.org/', 'Official npm registry');
    complete('https://registry.npmmirror.com/', 'npm China mirror');
  },

  'install-strategy': function (
    complete: (value: string, description: string) => void
  ) {
    // From npm help: hoisted|nested|shallow|linked
    complete('hoisted', 'Hoist all dependencies to top level');
    complete('nested', 'Create nested node_modules structure');
    complete('shallow', 'Shallow dependency installation');
    complete('linked', 'Use linked dependencies');
  },

  workspace: function (complete: (value: string, description: string) => void) {
    // Get workspace patterns from package.json workspaces or pnpm-workspace.yaml
    const workspacePatterns = getWorkspacePatterns();
    workspacePatterns.forEach((pattern) => {
      complete(pattern, `Workspace pattern: ${pattern}`);
    });

    // Common workspace patterns
    complete('packages/*', 'All packages in packages directory');
    complete('apps/*', 'All apps in apps directory');
  },

  omit: function (complete: (value: string, description: string) => void) {
    // From npm help: dev|optional|peer
    complete('dev', 'Omit devDependencies');
    complete('optional', 'Omit optionalDependencies');
    complete('peer', 'Omit peerDependencies');
  },

  include: function (complete: (value: string, description: string) => void) {
    // From npm help: prod|dev|optional|peer
    complete('prod', 'Include production dependencies');
    complete('dev', 'Include devDependencies');
    complete('optional', 'Include optionalDependencies');
    complete('peer', 'Include peerDependencies');
  },
};

// parse npm help text to extract commands and their descriptions
export function parseNpmHelp(helpText: string): Record<string, string> {
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);

  // find "All commands:" section
  let startIndex = -1;
  for (let i = 0; i < helpLines.length; i++) {
    if (ALL_COMMANDS_RE.test(helpLines[i].trim())) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) return {};

  const commands: Record<string, string> = {};
  let commandsText = '';

  // collect all lines that are part of the commands section
  for (let i = startIndex; i < helpLines.length; i++) {
    const line = helpLines[i];

    // stop if we hit a non-indented line that starts a new section
    if (!NON_INDENTED_LINE_RE.test(line) && line.trim() && !line.includes(','))
      break;

    // add this line to our commands text
    if (NON_INDENTED_LINE_RE.test(line)) {
      commandsText += ' ' + line.trim();
    }
  }

  // parse the comma-separated command list
  const commandList = commandsText
    .split(',')
    .map((cmd) => cmd.trim())
    .filter((cmd) => cmd && COMMAND_VALIDATION_RE.test(cmd));

  // npm does not ptrovide descriptions in the main help.
  commandList.forEach((cmd) => {
    commands[cmd] = ' ';
  });

  // this is the most common used aliase that isn't in the main list
  commands['run'] = ' ';

  return commands;
}

// Get npm commands from the main help output
export async function getNpmCommandsFromMainHelp(): Promise<
  Record<string, string>
> {
  try {
    const { stdout } = await exec('npm --help', {
      encoding: 'utf8',
      timeout: 500,
      maxBuffer: 4 * 1024 * 1024,
    });
    return parseNpmHelp(stdout);
  } catch (error: any) {
    // npm --help exits with status 1 but still provides output
    if (error.stdout) {
      return parseNpmHelp(error.stdout);
    }
    return {};
  }
}

// Parse npm options from help text (npm has a different format than pnpm)
export function parseNpmOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);
  const optionsOut: ParsedOption[] = [];

  // Find the Options: section
  let optionsStartIndex = -1;
  for (let i = 0; i < helpLines.length; i++) {
    if (OPTIONS_SECTION_RE.test(helpLines[i].trim())) {
      optionsStartIndex = i + 1;
      break;
    }
  }

  if (optionsStartIndex === -1) return [];

  // Parse the compact npm option format: [-S|--save|--no-save] etc.
  for (let i = optionsStartIndex; i < helpLines.length; i++) {
    const line = helpLines[i];

    // Stop at aliases or other sections
    if (SECTION_END_RE.test(line.trim())) break;

    // Parse option patterns like [-S|--save] or [--loglevel <level>]
    const optionMatches = line.matchAll(NPM_OPTION_RE);

    for (const match of optionMatches) {
      const short = match[1] || undefined;
      const long = match[2];

      // Check if this option takes a value
      const takesValue = OPTION_VALUE_RE.test(match[0]);

      if (flagsOnly && takesValue) continue;

      optionsOut.push({
        short,
        long,
        desc: `npm ${long} option`,
      });
    }
  }

  return optionsOut;
}

// Load dynamic options synchronously when requested
export function loadDynamicOptionsSync(
  cmd: LazyCommand,
  command: string
): void {
  try {
    const stdout = execSync(`npm ${command} --help`, {
      encoding: 'utf8',
      timeout: 500,
    });

    const allOptions = parseNpmOptions(stdout, { flagsOnly: false });

    for (const { long, short, desc } of allOptions) {
      const alreadyDefined = cmd.optionsRaw?.get?.(long);
      if (!alreadyDefined) {
        const handler =
          npmOptionHandlers[long as keyof typeof npmOptionHandlers];
        if (handler) {
          cmd.option(long, desc, handler, short);
        } else {
          cmd.option(long, desc, short);
        }
      }
    }
  } catch (error: unknown) {
    // npm help commands may exit with status 1 but still provide output
    if (error instanceof Error && 'stdout' in error) {
      try {
        const allOptions = parseNpmOptions(error.stdout as string, {
          flagsOnly: false,
        });
        for (const { long, short, desc } of allOptions) {
          const alreadyDefined = cmd.optionsRaw?.get?.(long);
          if (!alreadyDefined) {
            const handler =
              npmOptionHandlers[long as keyof typeof npmOptionHandlers];
            if (handler) {
              cmd.option(long, desc, handler, short);
            } else {
              cmd.option(long, desc, short);
            }
          }
        }
      } catch {}
    }
  }
}

// Setup lazy option loading for a command
function setupLazyOptionLoading(cmd: LazyCommand, command: string): void {
  cmd._lazyCommand = command;
  cmd._optionsLoaded = false;

  const optionsStore = cmd.options;
  cmd.optionsRaw = optionsStore;

  Object.defineProperty(cmd, 'options', {
    get() {
      if (!this._optionsLoaded) {
        this._optionsLoaded = true;
        loadDynamicOptionsSync(this, this._lazyCommand);
      }
      return optionsStore;
    },
    configurable: true,
  });
}

export async function setupNpmCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commandsWithDescriptions = await getNpmCommandsFromMainHelp();

    for (const [command, description] of Object.entries(
      commandsWithDescriptions
    )) {
      const cmd = completion.command(command, description);

      if (['remove', 'rm', 'uninstall', 'un'].includes(command)) {
        cmd.argument('package', packageJsonDependencyCompletion);
      }
      if (['run', 'run-script'].includes(command)) {
        cmd.argument('script', packageJsonScriptCompletion, true);
      }

      setupLazyOptionLoading(cmd, command);
    }
  } catch (_err) {}
}
