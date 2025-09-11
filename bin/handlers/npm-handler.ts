import type { PackageManagerCompletion } from '../package-manager-completion.js';
import { stripAnsiEscapes, type ParsedOption } from '../utils/text-utils.js';
import {
  LazyCommand,
  OptionHandlers,
  commonOptionHandlers,
  setupLazyOptionLoading,
  setupCommandArguments,
  safeExec,
  safeExecSync,
  createLogLevelHandler,
} from '../utils/package-manager-base.js';

// regex patterns to avoid recompilation in loops
const ALL_COMMANDS_RE = /^All commands:\s*$/i;
const OPTIONS_SECTION_RE = /^Options:\s*$/i;
const SECTION_END_RE = /^(aliases|run|more)/i;
const COMMAND_VALIDATION_RE = /^[a-z][a-z0-9-]*$/;
const NPM_OPTION_RE =
  /(?:\[)?(?:-([a-z])\|)?--([a-z][a-z0-9-]+)(?:\s+<[^>]+>)?(?:\])?/gi;
const OPTION_VALUE_RE = /<[^>]+>/;
const NON_INDENTED_LINE_RE = /^\s/;

const npmOptionHandlers: OptionHandlers = {
  ...commonOptionHandlers,

  // npm log levels
  loglevel: createLogLevelHandler([
    'silent',
    'error',
    'warn',
    'notice',
    'http',
    'info',
    'verbose',
    'silly',
  ]),

  'install-strategy': function (complete) {
    // From npm help: hoisted|nested|shallow|linked
    complete('hoisted', 'Hoist all dependencies to top level');
    complete('nested', 'Create nested node_modules structure');
    complete('shallow', 'Shallow dependency installation');
    complete('linked', 'Use linked dependencies');
  },

  omit: function (complete) {
    // From npm help: dev|optional|peer
    complete('dev', 'Omit devDependencies');
    complete('optional', 'Omit optionalDependencies');
    complete('peer', 'Omit peerDependencies');
  },

  include: function (complete) {
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
  const output = await safeExec('npm --help');
  return output ? parseNpmHelp(output) : {};
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
        desc: ' ',
      });
    }
  }

  return optionsOut;
}

// Load dynamic options synchronously when requested
function loadNpmOptionsSync(cmd: LazyCommand, command: string): void {
  const output = safeExecSync(`npm ${command} --help`);
  if (!output) return;

  const allOptions = parseNpmOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of allOptions) {
    const alreadyDefined = cmd.optionsRaw?.get?.(long);
    if (!alreadyDefined) {
      const handler = npmOptionHandlers[long];
      if (handler) {
        cmd.option(long, desc, handler, short);
      } else {
        cmd.option(long, desc, short);
      }
    }
  }
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

      // Setup common argument patterns
      setupCommandArguments(cmd, command, 'npm');

      // Setup lazy option loading
      setupLazyOptionLoading(cmd, command, 'npm', loadNpmOptionsSync);
    }
  } catch (_err) {}
}
