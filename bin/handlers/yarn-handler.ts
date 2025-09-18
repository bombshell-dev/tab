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

const OPTIONS_SECTION_RE = /^\s*Options:\s*$/i;
const COMMANDS_SECTION_RE = /^\s*Commands:\s*$/i;
const SECTION_END_RE = /^(Run `yarn help|Visit https:\/\/)/i;
const LINE_SPLIT_RE = /\r?\n/;
const YARN_OPTION_RE =
  /^\s*(?:-([a-zA-Z]),?\s*)?--([a-z][a-z0-9-]*)(?:\s+<[^>]+>|\s+\[[^\]]+\])?\s+(.+)$/;
const YARN_COMMAND_RE = /^\s*-\s+([a-z][a-z0-9-]*(?:\s*\/\s*[a-z][a-zA-Z]*)*)/;

function toLines(text: string): string[] {
  return stripAnsiEscapes(text).split(LINE_SPLIT_RE);
}

function findSectionStart(lines: string[], header: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i].trim())) return i + 1;
  }
  return -1;
}

const yarnOptionHandlers: OptionHandlers = {
  ...commonOptionHandlers,

  emoji(complete) {
    complete('true', ' ');
    complete('false', ' ');
  },

  production(complete) {
    complete('true', ' ');
    complete('false', ' ');
  },

  'scripts-prepend-node-path'(complete) {
    complete('true', ' ');
    complete('false', ' ');
  },
};

export function parseYarnHelp(helpText: string): Record<string, string> {
  const lines = toLines(helpText);
  const commands: Record<string, string> = {};

  const startIndex = findSectionStart(lines, COMMANDS_SECTION_RE);
  if (startIndex === -1) return commands;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // Stop at section end
    if (SECTION_END_RE.test(line)) break;

    if (!line.trim()) continue;

    const match = line.match(YARN_COMMAND_RE);
    if (match) {
      const [, commandWithAliases] = match;
      // handle commands with aliases like "generate-lock-entry / generateLockEntry"
      const commands_parts = commandWithAliases.split(/\s*\/\s*/);
      const mainCommand = commands_parts[0].trim();

      if (mainCommand) {
        // yarn doesn't provide descriptions in main help, use empty string
        commands[mainCommand] = '';

        // add aliases if they exist
        for (let j = 1; j < commands_parts.length; j++) {
          const alias = commands_parts[j].trim();
          if (alias) {
            commands[alias] = '';
          }
        }
      }
    }
  }

  return commands;
}

export async function getYarnCommandsFromMainHelp(): Promise<
  Record<string, string>
> {
  const output = await safeExec('cd /tmp && yarn --help');
  return output ? parseYarnHelp(output) : {};
}

export function parseYarnOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  const lines = toLines(helpText);
  const out: ParsedOption[] = [];

  const start = findSectionStart(lines, OPTIONS_SECTION_RE);
  if (start === -1) return out;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION_END_RE.test(line.trim())) break;

    const m = line.match(YARN_OPTION_RE);
    if (!m) continue;

    const [, short, long, desc] = m;
    const takesValue = line.includes('<') || line.includes('[');
    if (flagsOnly && takesValue) continue;

    out.push({
      short: short || undefined,
      long,
      desc: desc.trim(),
    });
  }

  return out;
}

function loadYarnOptionsSync(cmd: LazyCommand, command: string): void {
  // Use cd /tmp to avoid packageManager constraints
  const output = safeExecSync(`cd /tmp && yarn ${command} --help`);
  if (!output) return;

  const options = parseYarnOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of options) {
    const exists = cmd.optionsRaw?.get?.(long);
    if (exists) continue;

    const handler = yarnOptionHandlers[long];
    if (handler) cmd.option(long, desc, handler, short);
    else cmd.option(long, desc, short);
  }
}

export async function setupYarnCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commands = await getYarnCommandsFromMainHelp();

    for (const [command, description] of Object.entries(commands)) {
      const c = completion.command(command, description);
      setupCommandArguments(c, command, 'yarn');
      setupLazyOptionLoading(c, command, 'yarn', loadYarnOptionsSync);
    }
  } catch {}
}
