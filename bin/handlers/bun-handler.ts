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
} from '../utils/package-manager-base.js';

// regex patterns to avoid recompilation in loops
const COMMANDS_SECTION_RE = /^Commands:\s*$/i;
const FLAGS_SECTION_RE = /^Flags:\s*$/i;
const SECTION_END_RE = /^(Examples|Full documentation|Learn more)/i;
const COMMAND_VALIDATION_RE = /^[a-z][a-z0-9-]*$/;
const BUN_OPTION_RE =
  /^\s*(?:-([a-zA-Z]),?\s*)?--([a-z][a-z0-9-]*)(?:=<[^>]+>)?\s+(.+)$/;
// const NON_INDENTED_LINE_RE = /^\s/;

// bun-specific completion handlers
const bunOptionHandlers: OptionHandlers = {
  // Use common handlers
  ...commonOptionHandlers,

  // bun doesn't have traditional log levels, but has verbose/silent
  silent: function (complete) {
    complete('true', 'Enable silent mode');
    complete('false', 'Disable silent mode');
  },

  backend: function (complete) {
    // From bun help: "clonefile" (default), "hardlink", "symlink", "copyfile"
    complete('clonefile', 'Clone files (default, fastest)');
    complete('hardlink', 'Use hard links');
    complete('symlink', 'Use symbolic links');
    complete('copyfile', 'Copy files');
  },

  linker: function (complete) {
    // From bun help: "isolated" or "hoisted"
    complete('isolated', 'Isolated linker strategy');
    complete('hoisted', 'Hoisted linker strategy');
  },

  omit: function (complete) {
    // From bun help: 'dev', 'optional', or 'peer'
    complete('dev', 'Omit devDependencies');
    complete('optional', 'Omit optionalDependencies');
    complete('peer', 'Omit peerDependencies');
  },

  shell: function (complete) {
    // From bun help: 'bun' or 'system'
    complete('bun', 'Use Bun shell');
    complete('system', 'Use system shell');
  },

  'unhandled-rejections': function (complete) {
    // From bun help: "strict", "throw", "warn", "none", or "warn-with-error-code"
    complete('strict', 'Strict unhandled rejection handling');
    complete('throw', 'Throw on unhandled rejections');
    complete('warn', 'Warn on unhandled rejections');
    complete('none', 'Ignore unhandled rejections');
    complete('warn-with-error-code', 'Warn with error code');
  },
};

// Parse bun help text to extract commands and their descriptions
export function parseBunHelp(helpText: string): Record<string, string> {
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);

  // Find "Commands:" section
  let startIndex = -1;
  for (let i = 0; i < helpLines.length; i++) {
    if (COMMANDS_SECTION_RE.test(helpLines[i].trim())) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) return {};

  const commands: Record<string, string> = {};

  // Parse bun's unique command format
  for (let i = startIndex; i < helpLines.length; i++) {
    const line = helpLines[i];

    // Stop when we hit Flags section or empty line followed by non-command content
    if (
      FLAGS_SECTION_RE.test(line.trim()) ||
      (line.trim() === '' &&
        i + 1 < helpLines.length &&
        !helpLines[i + 1].match(/^\s+[a-z]/))
    )
      break;

    // Skip empty lines
    if (line.trim() === '') continue;

    // Handle different bun command formats:
    // Format 1: "  run       ./my-script.ts       Execute a file with Bun"
    // Format 2: "            lint                 Run a package.json script" (continuation)
    // Format 3: "  install                        Install dependencies for a package.json (bun i)"

    // Try to match command at start of line (2 spaces)
    const mainCommandMatch = line.match(/^  ([a-z][a-z0-9-]*)\s+(.+)$/);
    if (mainCommandMatch) {
      const [, command, rest] = mainCommandMatch;
      if (COMMAND_VALIDATION_RE.test(command)) {
        // Extract description - find the last part that looks like a description
        // Split by multiple spaces and take the last part that contains letters
        const parts = rest.split(/\s{2,}/);
        let description = parts[parts.length - 1];

        // If the last part starts with a capital letter, it's likely the description
        if (description && /^[A-Z]/.test(description)) {
          commands[command] = description.trim();
        } else if (parts.length > 1) {
          // Otherwise, look for the first part that starts with a capital
          for (const part of parts) {
            if (/^[A-Z]/.test(part)) {
              commands[command] = part.trim();
              break;
            }
          }
        }
      }
    }

    // Handle continuation lines (12+ spaces)
    const continuationMatch = line.match(/^\s{12,}([a-z][a-z0-9-]*)\s+(.+)$/);
    if (continuationMatch) {
      const [, command, description] = continuationMatch;
      if (COMMAND_VALIDATION_RE.test(command)) {
        commands[command] = description.trim();
      }
    }
  }

  return commands;
}

// Get bun commands from the main help output
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

// Load dynamic options synchronously when requested
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
