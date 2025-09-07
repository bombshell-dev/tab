import { promisify } from 'node:util';
import child_process from 'node:child_process';

const exec = promisify(child_process.exec);
const { execSync } = child_process;
import type { PackageManagerCompletion } from '../package-manager-completion.js';
import { Command } from '../../src/t.js';

interface LazyCommand extends Command {
  _lazyCommand?: string;
  _optionsLoaded?: boolean;
  optionsRaw?: Map<string, any>;
}

import {
  packageJsonScriptCompletion,
  packageJsonDependencyCompletion,
} from '../completions/completion-producers.js';
import {
  stripAnsiEscapes,
  measureIndent,
  parseAliasList,
  COMMAND_ROW_RE,
  OPTION_ROW_RE,
  OPTION_HEAD_RE,
  type ParsedOption,
} from '../utils/text-utils.js';

// regex to detect options section in help text
const OPTIONS_SECTION_RE = /^\s*Options:/i;

// we parse the pnpm help text to extract commands and their descriptions!
export function parsePnpmHelp(helpText: string): Record<string, string> {
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);

  // we find the earliest description column across command rows.
  let descColumnIndex = Number.POSITIVE_INFINITY;
  for (const line of helpLines) {
    const rowMatch = line.match(COMMAND_ROW_RE);
    if (!rowMatch) continue;
    const descColumnIndexOnThisLine = line.indexOf(rowMatch[2]);
    if (
      descColumnIndexOnThisLine >= 0 &&
      descColumnIndexOnThisLine < descColumnIndex
    ) {
      descColumnIndex = descColumnIndexOnThisLine;
    }
  }
  if (!Number.isFinite(descColumnIndex)) return {};

  // we fold rows, and join continuation lines aligned to descColumnIndex or deeper.
  type PendingRow = { names: string[]; desc: string } | null;
  let pendingRow: PendingRow = null;

  const commandMap = new Map<string, string>();
  const flushPendingRow = () => {
    if (!pendingRow) return;
    const desc = pendingRow.desc.trim();
    for (const name of pendingRow.names) commandMap.set(name, desc);
    pendingRow = null;
  };

  for (const line of helpLines) {
    if (OPTIONS_SECTION_RE.test(line)) break; // we stop at options

    // we match the command row
    const rowMatch = line.match(COMMAND_ROW_RE);
    if (rowMatch) {
      flushPendingRow();
      pendingRow = {
        names: parseAliasList(rowMatch[1]),
        desc: rowMatch[2].trim(),
      };
      continue;
    }

    // we join continuation lines aligned to descColumnIndex or deeper
    if (pendingRow) {
      const indentWidth = measureIndent(line);
      if (indentWidth >= descColumnIndex && line.trim()) {
        pendingRow.desc += ' ' + line.trim();
      }
    }
  }
  // we flush the pending row and return the command map
  flushPendingRow();

  return Object.fromEntries(commandMap);
}

// now we get the pnpm commands from the main help output
export async function getPnpmCommandsFromMainHelp(): Promise<
  Record<string, string>
> {
  try {
    const { stdout } = await exec('pnpm --help', {
      encoding: 'utf8',
      timeout: 500,
      maxBuffer: 4 * 1024 * 1024,
    });
    return parsePnpmHelp(stdout);
  } catch {
    return {};
  }
}

// here we parse the pnpm options from the help text
export function parsePnpmOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  // we strip the ANSI escapes from the help text
  const helpLines = stripAnsiEscapes(helpText).split(/\r?\n/);

  // we find the earliest description column among option rows we care about
  let descColumnIndex = Number.POSITIVE_INFINITY;
  for (const line of helpLines) {
    const optionMatch = line.match(OPTION_ROW_RE);
    if (!optionMatch) continue;
    if (flagsOnly && optionMatch.groups?.val) continue; // skip value-taking options, we will add them manually with their value
    const descColumnIndexOnThisLine = line.indexOf(optionMatch.groups!.desc);
    if (
      descColumnIndexOnThisLine >= 0 &&
      descColumnIndexOnThisLine < descColumnIndex
    ) {
      descColumnIndex = descColumnIndexOnThisLine;
    }
  }
  if (!Number.isFinite(descColumnIndex)) return [];

  // we fold the option rows and join the continuations
  const optionsOut: ParsedOption[] = [];
  let pendingOption: ParsedOption | null = null;

  const flushPendingOption = () => {
    if (!pendingOption) return;
    pendingOption.desc = pendingOption.desc.trim();
    optionsOut.push(pendingOption);
    pendingOption = null;
  };

  // we match the option row
  for (const line of helpLines) {
    const optionMatch = line.match(OPTION_ROW_RE);
    if (optionMatch) {
      if (flagsOnly && optionMatch.groups?.val) continue;
      flushPendingOption();
      pendingOption = {
        short: optionMatch.groups?.short || undefined,
        long: optionMatch.groups!.long,
        desc: optionMatch.groups!.desc.trim(),
      };
      continue;
    }

    // we join the continuations
    if (pendingOption) {
      const indentWidth = measureIndent(line);
      const startsNewOption = OPTION_HEAD_RE.test(line);
      if (indentWidth >= descColumnIndex && line.trim() && !startsNewOption) {
        pendingOption.desc += ' ' + line.trim();
      }
    }
  }
  // we flush the pending option
  flushPendingOption();

  return optionsOut;
}

// we load the dynamic options synchronously when requested ( separated from the command loading )
export function loadDynamicOptionsSync(
  cmd: LazyCommand,
  command: string
): void {
  try {
    const stdout = execSync(`pnpm ${command} --help`, {
      encoding: 'utf8',
      timeout: 500,
    });

    const parsedOptions = parsePnpmOptions(stdout, { flagsOnly: true });

    for (const { long, short, desc } of parsedOptions) {
      const alreadyDefined = cmd.optionsRaw?.get?.(long);
      if (!alreadyDefined) cmd.option(long, desc, short);
    }
  } catch (_err) {}
}

// we setup the lazy option loading for a command

function setupLazyOptionLoading(cmd: LazyCommand, command: string): void {
  cmd._lazyCommand = command;
  cmd._optionsLoaded = false;

  const optionsStore = cmd.options;
  cmd.optionsRaw = optionsStore;

  Object.defineProperty(cmd, 'options', {
    get() {
      if (!this._optionsLoaded) {
        this._optionsLoaded = true;
        loadDynamicOptionsSync(this, this._lazyCommand); // block until filled
      }
      return optionsStore;
    },
    configurable: true,
  });
}

export async function setupPnpmCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commandsWithDescriptions = await getPnpmCommandsFromMainHelp();

    for (const [command, description] of Object.entries(
      commandsWithDescriptions
    )) {
      const cmd = completion.command(command, description);

      if (['remove', 'rm', 'update', 'up'].includes(command)) {
        cmd.argument('package', packageJsonDependencyCompletion);
      }
      if (command === 'run') {
        cmd.argument('script', packageJsonScriptCompletion, true);
      }

      setupLazyOptionLoading(cmd, command);
    }
  } catch (_err) {}
}
