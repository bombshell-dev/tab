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
const LINE_SPLIT_RE = /\r?\n/;

function toLines(text: string): string[] {
  return stripAnsiEscapes(text).split(LINE_SPLIT_RE);
}

function findSectionStart(lines: string[], header: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i].trim())) return i + 1;
  }
  return -1;
}

const bunOptionHandlers: OptionHandlers = {
  ...commonOptionHandlers,

  silent(complete) {
    complete('true', 'Enable silent mode');
    complete('false', 'Disable silent mode');
  },

  backend(complete) {
    complete('clonefile', 'Clone files (default, fastest)');
    complete('hardlink', 'Use hard links');
    complete('symlink', 'Use symbolic links');
    complete('copyfile', 'Copy files');
  },

  linker(complete) {
    complete('isolated', 'Isolated linker strategy');
    complete('hoisted', 'Hoisted linker strategy');
  },

  omit(complete) {
    complete('dev', 'Omit devDependencies');
    complete('optional', 'Omit optionalDependencies');
    complete('peer', 'Omit peerDependencies');
  },

  shell(complete) {
    complete('bun', 'Use Bun shell');
    complete('system', 'Use system shell');
  },

  'unhandled-rejections'(complete) {
    complete('strict', 'Strict unhandled rejection handling');
    complete('throw', 'Throw on unhandled rejections');
    complete('warn', 'Warn on unhandled rejections');
    complete('none', 'Ignore unhandled rejections');
    complete('warn-with-error-code', 'Warn with error code');
  },
};

/** ---------- Commands ---------- */
export function parseBunHelp(helpText: string): Record<string, string> {
  const lines = toLines(helpText);

  const startIndex = findSectionStart(lines, COMMANDS_SECTION_RE);
  if (startIndex === -1) return {};

  const commands: Record<string, string> = {};

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // stop when we hit Flags section or empty line followed by non-command content
    if (
      FLAGS_SECTION_RE.test(line.trim()) ||
      (line.trim() === '' &&
        i + 1 < lines.length &&
        !lines[i + 1].match(EMPTY_LINE_FOLLOWED_BY_NON_COMMAND_RE))
    ) {
      break;
    }

    if (!line.trim()) continue;

    // main command row
    const main = line.match(MAIN_COMMAND_RE);
    if (main) {
      const [, command, rest] = main;
      if (COMMAND_VALIDATION_RE.test(command)) {
        const parts = rest.split(DESCRIPTION_SPLIT_RE);
        let desc = parts[parts.length - 1];

        if (desc && CAPITAL_LETTER_START_RE.test(desc)) {
          commands[command] = desc.trim();
        } else if (parts.length > 1) {
          for (const p of parts) {
            if (CAPITAL_LETTER_START_RE.test(p)) {
              commands[command] = p.trim();
              break;
            }
          }
        }
      }
    }

    const cont = line.match(CONTINUATION_COMMAND_RE);
    if (cont) {
      const [, command, description] = cont;
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

export function parseBunOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  const lines = toLines(helpText);
  const out: ParsedOption[] = [];

  const start = findSectionStart(lines, FLAGS_SECTION_RE);
  if (start === -1) return out;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION_END_RE.test(line.trim())) break;

    const m = line.match(BUN_OPTION_RE);
    if (!m) continue;

    const [, short, long, desc] = m;
    const takesValue = line.includes('=<'); // bun shows value as --opt=<val>
    if (flagsOnly && takesValue) continue;

    out.push({
      short: short || undefined,
      long,
      desc: desc.trim(),
    });
  }

  return out;
}

function loadBunOptionsSync(cmd: LazyCommand, command: string): void {
  const output = safeExecSync(`bun ${command} --help`);
  if (!output) return;

  const options = parseBunOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of options) {
    const exists = cmd.optionsRaw?.get?.(long);
    if (exists) continue;

    const handler = bunOptionHandlers[long];
    if (handler) cmd.option(long, desc, handler, short);
    else cmd.option(long, desc, short);
  }
}

export async function setupBunCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commands = await getBunCommandsFromMainHelp();

    for (const [command, description] of Object.entries(commands)) {
      const c = completion.command(command, description);
      setupCommandArguments(c, command, 'bun');
      setupLazyOptionLoading(c, command, 'bun', loadBunOptionsSync);
    }
  } catch {}
}
