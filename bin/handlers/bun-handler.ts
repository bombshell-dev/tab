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
  // createLogLevelHandler,
} from '../utils/shared.js';

const COMMANDS_SECTION_RE = /^Commands:\s*$/i;
const FLAGS_SECTION_RE = /^Flags:\s*$/i;
const SECTION_END_RE = /^(Examples|Full documentation|Learn more)/i;
const COMMAND_VALIDATION_RE = /^[a-z][a-z0-9-]*$/;
const BUN_OPTION_RE =
  /^\s*(?:-([a-zA-Z]),?\s*)?--([a-z][a-z0-9-]*)(?:=<[^>]+>)?\s+(.+)$/;
const MAIN_COMMAND_RE = /^  ([a-z][a-z0-9-]*)\s+(.+)$/;
const CONTINUATION_COMMAND_RE = /^\s{12,}([a-z][a-z0-9-]*)\s+(.+)$/;
const EMPTY_LINE_FOLLOWED_BY_NON_COMMAND_RE = /^\s+[a-z]/;
const DESCRIPTION_SPLIT_RE = /\s{2,}/;
const CAPITAL_LETTER_START_RE = /^[A-Z]/;

const bunOptionHandlers: OptionHandlers = {
  ...commonOptionHandlers,

  silent: function (complete) {
    complete('true', 'Enable silent mode');
    complete('false', 'Disable silent mode');
  },

  backend: function (complete) {
    complete('clonefile', 'Clone files (default, fastest)');
    complete('hardlink', 'Use hard links');
    complete('symlink', 'Use symbolic links');
    complete('copyfile', 'Copy files');
  },

  linker: function (complete) {
    complete('isolated', 'Isolated linker strategy');
    complete('hoisted', 'Hoisted linker strategy');
  },

  omit: function (complete) {
    complete('dev', 'Omit devDependencies');
    complete('optional', 'Omit optionalDependencies');
    complete('peer', 'Omit peerDependencies');
  },

  shell: function (complete) {
    complete('bun', 'Use Bun shell');
    complete('system', 'Use system shell');
  },

  'unhandled-rejections': function (complete) {
    complete('strict', 'Strict unhandled rejection handling');
    complete('throw', 'Throw on unhandled rejections');
    complete('warn', 'Warn on unhandled rejections');
    complete('none', 'Ignore unhandled rejections');
    complete('warn-with-error-code', 'Warn with error code');
  },
};

export function parseBunHelp(helpText: string): Record<string, string> {
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);

  let startIndex = -1;
  for (let i = 0; i < helpLines.length; i++) {
    if (COMMANDS_SECTION_RE.test(helpLines[i].trim())) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) return {};

  const commands: Record<string, string> = {};

  // parse bun's unique command format
  for (let i = startIndex; i < helpLines.length; i++) {
    const line = helpLines[i];

    // stop when we hit Flags section or empty line followed by non-command content
    if (
      FLAGS_SECTION_RE.test(line.trim()) ||
      (line.trim() === '' &&
        i + 1 < helpLines.length &&
        !helpLines[i + 1].match(EMPTY_LINE_FOLLOWED_BY_NON_COMMAND_RE))
    )
      break;

    // Skip empty lines
    if (line.trim() === '') continue;

    const mainCommandMatch = line.match(MAIN_COMMAND_RE);
    if (mainCommandMatch) {
      const [, command, rest] = mainCommandMatch;
      if (COMMAND_VALIDATION_RE.test(command)) {
        const parts = rest.split(DESCRIPTION_SPLIT_RE);
        let description = parts[parts.length - 1];

        // If the last part starts with  capital letter, it's likely the description
        if (description && CAPITAL_LETTER_START_RE.test(description)) {
          commands[command] = description.trim();
        } else if (parts.length > 1) {
          for (const part of parts) {
            if (CAPITAL_LETTER_START_RE.test(part)) {
              commands[command] = part.trim();
              break;
            }
          }
        }
      }
    }

    const continuationMatch = line.match(CONTINUATION_COMMAND_RE);
    if (continuationMatch) {
      const [, command, description] = continuationMatch;
      if (COMMAND_VALIDATION_RE.test(command)) {
        commands[command] = description.trim();
      }
    }
  }

  return commands;
}

export async function getBunCommandsFromMainHelp(): Promise<
  Record<string, string>
> {
  const output = await safeExec('bun --help');
  return output ? parseBunHelp(output) : {};
}

// Parse bun options from help text
export function parseBunOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);
  const optionsOut: ParsedOption[] = [];

  // Find the Flags: section
  let optionsStartIndex = -1;
  for (let i = 0; i < helpLines.length; i++) {
    if (FLAGS_SECTION_RE.test(helpLines[i].trim())) {
      optionsStartIndex = i + 1;
      break;
    }
  }

  if (optionsStartIndex === -1) return [];

  // Parse bun's flag format
  for (let i = optionsStartIndex; i < helpLines.length; i++) {
    const line = helpLines[i];

    // Stop at examples or other sections
    if (SECTION_END_RE.test(line.trim())) break;

    // Parse option lines like: "  -c, --config=<val>                 Specify path to config file"
    const optionMatch = line.match(BUN_OPTION_RE);

    if (optionMatch) {
      const [, short, long, desc] = optionMatch;

      // Check if this option takes a value (has =<val>)
      const takesValue = line.includes('=<');

      if (flagsOnly && takesValue) continue;

      optionsOut.push({
        short: short || undefined,
        long,
        desc: desc.trim(),
      });
    }
  }

  return optionsOut;
}

// load dynamic options synchronously when requested
function loadBunOptionsSync(cmd: LazyCommand, command: string): void {
  const output = safeExecSync(`bun ${command} --help`);
  if (!output) return;

  const allOptions = parseBunOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of allOptions) {
    const alreadyDefined = cmd.optionsRaw?.get?.(long);
    if (!alreadyDefined) {
      const handler = bunOptionHandlers[long];
      if (handler) {
        cmd.option(long, desc, handler, short);
      } else {
        cmd.option(long, desc, short);
      }
    }
  }
}

export async function setupBunCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commandsWithDescriptions = await getBunCommandsFromMainHelp();

    for (const [command, description] of Object.entries(
      commandsWithDescriptions
    )) {
      const cmd = completion.command(command, description);

      // Setup common argument patterns
      setupCommandArguments(cmd, command, 'bun');

      // Setup lazy option loading
      setupLazyOptionLoading(cmd, command, 'bun', loadBunOptionsSync);
    }
  } catch (_err) {}
}
