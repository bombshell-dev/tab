import type { PackageManagerCompletion } from '../package-manager-completion.js';
import { getWorkspacePatterns } from '../utils/filesystem-utils.js';
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
import {
  stripAnsiEscapes,
  measureIndent,
  parseAliasList,
  COMMAND_ROW_RE,
  OPTION_ROW_RE,
  OPTION_HEAD_RE,
  type ParsedOption,
} from '../utils/text-utils.js';

// regex patterns to avoid recompilation in loops
const OPTIONS_SECTION_RE = /^\s*Options:/i;
const LEVEL_MATCH_RE = /(?:levels?|options?|values?)[^:]*:\s*([^.]+)/i;

function extractValidValuesFromHelp(
  helpText: string,
  optionName: string
): Array<{ value: string; desc: string }> {
  const lines = stripAnsiEscapes(helpText).split(/\r?\n/);

  // Handle reporter option specially
  if (optionName === 'reporter') {
    const reporterValues: Array<{ value: string; desc: string }> = [];

    // Simple approach: look for lines with "--reporter <value>"
    for (const helpLine of lines) {
      if (
        helpLine.includes('--reporter') &&
        helpLine.match(/^\s*--reporter\s+\w/)
      ) {
        const match = helpLine.match(/^\s*--reporter\s+(\w+|\w+-\w+)\s+(.+)$/);
        if (match) {
          const [, value, desc] = match;
          reporterValues.push({ value, desc: desc.trim() });
        }
      }

      // Handle special case: "-s, --silent, --reporter silent"
      const silentMatch = helpLine.match(
        /-s,\s*--silent,\s*--reporter\s+silent\s+(.+)/
      );
      if (silentMatch && !reporterValues.some((r) => r.value === 'silent')) {
        reporterValues.push({ value: 'silent', desc: silentMatch[1].trim() });
      }
    }

    if (reporterValues.length > 0) {
      return reporterValues;
    }
  }

  // Handle other options
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`--${optionName}`) || line.includes(`${optionName}:`)) {
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const searchLine = lines[j];

        const levelMatch = searchLine.match(LEVEL_MATCH_RE);
        if (levelMatch) {
          return levelMatch[1]
            .split(/[,\s]+/)
            .map((v) => v.trim())
            .filter((v) => v && !v.includes('(') && !v.includes(')'))
            .map((value) => ({ value, desc: `Log level: ${value}` }));
        }
      }
    }
  }

  return [];
}

// pnpm-specific completion handlers
const pnpmOptionHandlers: OptionHandlers = {
  // Use common handlers
  ...commonOptionHandlers,

  // pnpm log levels with dynamic extraction fallback
  loglevel: function (complete) {
    const helpValues = extractValidValuesFromHelp(
      safeExecSync('pnpm install --help'),
      'loglevel'
    );

    if (helpValues.length > 0) {
      helpValues.forEach(({ value, desc }) => complete(value, desc));
    } else {
      // Fallback to known pnpm levels
      createLogLevelHandler(['debug', 'info', 'warn', 'error', 'silent'])(
        complete
      );
    }
  },

  reporter: function (complete) {
    // Extract reporter values dynamically from install help
    const helpOutput = safeExecSync('pnpm install --help');
    const reporterValues = extractValidValuesFromHelp(helpOutput, 'reporter');

    if (reporterValues.length > 0) {
      reporterValues.forEach(({ value, desc }) => complete(value, desc));
    } else {
      // Fallback to common reporter types if extraction fails
      createLogLevelHandler(['default', 'append-only', 'ndjson', 'silent'])(
        complete
      );
    }
  },

  filter: function (complete) {
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
  const output = await safeExec('pnpm --help');
  return output ? parsePnpmHelp(output) : {};
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

// we load the dynamic options synchronously when requested
function loadPnpmOptionsSync(cmd: LazyCommand, command: string): void {
  const output = safeExecSync(`pnpm ${command} --help`);
  if (!output) return;

  const allOptions = parsePnpmOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of allOptions) {
    const alreadyDefined = cmd.optionsRaw?.get?.(long);
    if (!alreadyDefined) {
      const handler = pnpmOptionHandlers[long];
      if (handler) {
        cmd.option(long, desc, handler, short);
      } else {
        cmd.option(long, desc, short);
      }
    }
  }

  // Special case: add reporter option manually since it doesn't match standard pattern
  if (output.includes('--reporter') && !cmd.optionsRaw?.get?.('reporter')) {
    const handler = pnpmOptionHandlers['reporter'];
    if (handler) {
      cmd.option('reporter', 'Output reporter for pnpm commands', handler);
    }
  }
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

      // Setup common argument patterns
      setupCommandArguments(cmd, command, 'pnpm');

      // Setup lazy option loading
      setupLazyOptionLoading(cmd, command, 'pnpm', loadPnpmOptionsSync);
    }
  } catch (_err) {}
}
