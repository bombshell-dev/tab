import { promisify } from 'node:util';
import child_process from 'node:child_process';

const exec = promisify(child_process.exec);
const { execSync } = child_process;
import type { PackageManagerCompletion } from '../package-manager-completion.js';
import { Command, Option } from '../../src/t.js';

interface LazyCommand extends Command {
  _lazyCommand?: string;
  _optionsLoaded?: boolean;
  optionsRaw?: Map<string, Option>;
}

import {
  packageJsonScriptCompletion,
  packageJsonDependencyCompletion,
} from '../completions/completion-producers.js';
import { getWorkspacePatterns } from '../utils/filesystem-utils.js';
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

function extractValidValuesFromHelp(
  helpText: string,
  optionName: string
): string[] {
  const lines = stripAnsiEscapes(helpText).split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`--${optionName}`) || line.includes(`${optionName}:`)) {
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const searchLine = lines[j];

        const levelMatch = searchLine.match(
          /(?:levels?|options?|values?)[^:]*:\s*([^.]+)/i
        );
        if (levelMatch) {
          return levelMatch[1]
            .split(/[,\s]+/)
            .map((v) => v.trim())
            .filter((v) => v && !v.includes('(') && !v.includes(')'));
        }

        if (optionName === 'reporter') {
          const reporterMatch = searchLine.match(/--reporter\s+(\w+)/);
          if (reporterMatch) {
            const reporterValues = new Set<string>();
            for (const helpLine of lines) {
              const matches = helpLine.matchAll(/--reporter\s+(\w+)/g);
              for (const match of matches) {
                reporterValues.add(match[1]);
              }
            }
            return Array.from(reporterValues);
          }
        }
      }
    }
  }

  return [];
}

// completion handlers for pnpm options that take values
const pnpmOptionHandlers = {
  // Let shell handle directory completions - it's much better at it
  // dir, modules-dir, store-dir, lockfile-dir, virtual-store-dir removed

  loglevel: function (complete: (value: string, description: string) => void) {
    // Try to get values from help, fall back to known values
    const helpValues = extractValidValuesFromHelp(
      execSync('pnpm install --help', { encoding: 'utf8', timeout: 500 }),
      'loglevel'
    );

    if (helpValues.length > 0) {
      helpValues.forEach((value) => complete(value, `Log level: ${value}`));
    } else {
      // Fallback based on documented values
      ['debug', 'info', 'warn', 'error', 'silent'].forEach((level) =>
        complete(level, `Log level: ${level}`)
      );
    }
  },

  reporter: function (complete: (value: string, description: string) => void) {
    // valid values from pnpm help
    const reporters = [
      { value: 'default', desc: 'Default reporter when stdout is TTY' },
      {
        value: 'append-only',
        desc: 'Output always appended, no cursor manipulation',
      },
      { value: 'ndjson', desc: 'Most verbose reporter in NDJSON format' },
      { value: 'silent', desc: 'No output logged to console' },
    ];

    reporters.forEach(({ value, desc }) => complete(value, desc));
  },

  filter: function (complete: (value: string, description: string) => void) {
    // Based on pnpm documentation
    complete('.', 'Current working directory');
    complete('!<selector>', 'Exclude packages matching selector');

    // Get actual workspace patterns from pnpm-workspace.yaml
    const workspacePatterns = getWorkspacePatterns();
    workspacePatterns.forEach((pattern) => {
      complete(pattern, `Workspace pattern: ${pattern}`);
      complete(`${pattern}...`, `Include dependencies of ${pattern}`);
    });

    // Common scope patterns
    complete('@*/*', 'All scoped packages');
    complete('...<pattern>', 'Include dependencies of pattern');
    complete('<pattern>...', 'Include dependents of pattern');
  },
};

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
    if (flagsOnly && optionMatch.groups?.val) continue;
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

    const allOptions = parsePnpmOptions(stdout, { flagsOnly: false });

    for (const { long, short, desc } of allOptions) {
      const alreadyDefined = cmd.optionsRaw?.get?.(long);
      if (!alreadyDefined) {
        const handler =
          pnpmOptionHandlers[long as keyof typeof pnpmOptionHandlers];
        if (handler) {
          cmd.option(long, desc, handler, short);
        } else {
          cmd.option(long, desc, short);
        }
      }
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
