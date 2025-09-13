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
} from '../utils/shared.js';
import {
  stripAnsiEscapes,
  measureIndent,
  parseAliasList,
  COMMAND_ROW_RE,
  OPTION_ROW_RE,
  OPTION_HEAD_RE,
  type ParsedOption,
} from '../utils/text-utils.js';

const OPTIONS_SECTION_RE = /^\s*Options:/i;
const LEVEL_MATCH_RE = /(?:levels?|options?|values?)[^:]*:\s*([^.]+)/i;
const LINE_SPLIT_RE = /\r?\n/;
const COMMA_SPACE_SPLIT_RE = /[,\s]+/;
const OPTION_WITH_VALUE_RE =
  /^\s*(?:-\w,?\s*)?--(\w+(?:-\w+)*)\s+(\w+(?:-\w+)*)\s+(.+)$/;
const OPTION_ALIAS_RE =
  /^\s*-\w,?\s*--\w+(?:,\s*--(\w+(?:-\w+)*)\s+(\w+(?:-\w+)*))?\s+(.+)$/;
const CONTINUATION_LINE_RE = /^\s{20,}/;
const SECTION_HEADER_RE = /^\s*[A-Z][^:]*:\s*$/;

function toLines(text: string): string[] {
  return stripAnsiEscapes(text).split(LINE_SPLIT_RE);
}

function findCommandDescColumn(lines: string[]): number {
  let col = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    const m = line.match(COMMAND_ROW_RE);
    if (!m) continue;
    const idx = line.indexOf(m[2]);
    if (idx >= 0 && idx < col) col = idx;
  }
  return col;
}

function findOptionDescColumn(lines: string[], flagsOnly: boolean): number {
  let col = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    const m = line.match(OPTION_ROW_RE);
    if (!m) continue;
    if (flagsOnly && m.groups?.val) continue; // skip value-taking options in flagsOnly mode
    const idx = line.indexOf(m.groups!.desc);
    if (idx >= 0 && idx < col) col = idx;
  }
  return col;
}

function extractValidValuesFromHelp(
  helpText: string,
  optionName: string
): Array<{ value: string; desc: string }> {
  const lines = toLines(helpText);
  const results: Array<{ value: string; desc: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for options with values in any section
    const optionMatch = line.match(OPTION_WITH_VALUE_RE);
    if (optionMatch) {
      const [, option, value, initialDesc] = optionMatch;
      if (option === optionName) {
        // capture continuation lines for complete description
        let fullDesc = initialDesc.trim();
        let j = i + 1;

        // Look ahead for continuation lines (indented lines that don't start new options)
        while (j < lines.length) {
          const nextLine = lines[j];
          const isIndented = CONTINUATION_LINE_RE.test(nextLine);
          const isNewOption =
            OPTION_WITH_VALUE_RE.test(nextLine) ||
            OPTION_ALIAS_RE.test(nextLine);
          const isEmptyOrSection =
            !nextLine.trim() || SECTION_HEADER_RE.test(nextLine);

          if (isIndented && !isNewOption && !isEmptyOrSection) {
            fullDesc += ' ' + nextLine.trim();
            j++;
          } else {
            break;
          }
        }

        results.push({ value, desc: fullDesc });
      }
    }

    const aliasMatch = line.match(OPTION_ALIAS_RE);
    if (aliasMatch) {
      const [, option, value, initialDesc] = aliasMatch;
      if (option === optionName && value) {
        // capture continuation lines for alias descriptions too
        let fullDesc = initialDesc.trim();
        let j = i + 1;

        while (j < lines.length) {
          const nextLine = lines[j];
          const isIndented = CONTINUATION_LINE_RE.test(nextLine);
          const isNewOption =
            OPTION_WITH_VALUE_RE.test(nextLine) ||
            OPTION_ALIAS_RE.test(nextLine);
          const isEmptyOrSection =
            !nextLine.trim() || SECTION_HEADER_RE.test(nextLine);

          if (isIndented && !isNewOption && !isEmptyOrSection) {
            fullDesc += ' ' + nextLine.trim();
            j++;
          } else {
            break;
          }
        }

        results.push({ value, desc: fullDesc });
      }
    }
  }

  if (results.length) return results;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.includes(`--${optionName}`) || ln.includes(`${optionName}:`)) {
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const probe = lines[j];
        const m = probe.match(LEVEL_MATCH_RE);
        if (m) {
          return m[1]
            .split(COMMA_SPACE_SPLIT_RE)
            .map((v) => v.trim())
            .filter((v) => v && !v.includes('(') && !v.includes(')'))
            .map((value) => ({ value, desc: `Log level: ${value}` }));
        }
      }
    }
  }
  return [];
}

const pnpmOptionHandlers: OptionHandlers = {
  ...commonOptionHandlers,

  loglevel(complete) {
    const fromHelp = extractValidValuesFromHelp(
      safeExecSync('pnpm install --help'),
      'loglevel'
    );
    if (fromHelp.length) {
      fromHelp.forEach(({ value, desc }) => complete(value, desc));
    } else {
      createLogLevelHandler(['debug', 'info', 'warn', 'error', 'silent'])(
        complete
      );
    }
  },

  reporter(complete) {
    const out = extractValidValuesFromHelp(
      safeExecSync('pnpm install --help'),
      'reporter'
    );
    if (out.length) {
      out.forEach(({ value, desc }) => complete(value, desc));
    } else {
      createLogLevelHandler(['default', 'append-only', 'ndjson', 'silent'])(
        complete
      );
    }
  },

  filter(complete) {
    complete('.', 'Current working directory');
    complete('!<selector>', 'Exclude packages matching selector');

    const patterns = getWorkspacePatterns();
    patterns.forEach((p) => {
      complete(p, `Workspace pattern: ${p}`);
      complete(`${p}...`, `Include dependencies of ${p}`);
    });

    complete('@*/*', 'All scoped packages');
    complete('...<pattern>', 'Include dependencies of pattern');
    complete('<pattern>...', 'Include dependents of pattern');
  },
};

export function parsePnpmHelp(helpText: string): Record<string, string> {
  const lines = toLines(helpText);

  const descCol = findCommandDescColumn(lines);
  if (!Number.isFinite(descCol)) return {};

  type Pending = { names: string[]; desc: string } | null;
  let pending: Pending = null;

  const out = new Map<string, string>();

  const flush = () => {
    if (!pending) return;
    const desc = pending.desc.trim();
    for (const n of pending.names) out.set(n, desc);
    pending = null;
  };

  for (const line of lines) {
    if (OPTIONS_SECTION_RE.test(line)) break; // end of commands section

    const row = line.match(COMMAND_ROW_RE);
    if (row) {
      flush();
      pending = {
        names: parseAliasList(row[1]),
        desc: row[2].trim(),
      };
      continue;
    }

    if (pending) {
      const indent = measureIndent(line);
      if (indent >= descCol && line.trim()) {
        pending.desc += ' ' + line.trim();
      }
    }
  }
  flush();

  return Object.fromEntries(out);
}

export async function getPnpmCommandsFromMainHelp(): Promise<
  Record<string, string>
> {
  const output = await safeExec('pnpm --help');
  return output ? parsePnpmHelp(output) : {};
}

export function parsePnpmOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  const lines = toLines(helpText);

  const descCol = findOptionDescColumn(lines, flagsOnly);
  if (!Number.isFinite(descCol)) return [];

  const out: ParsedOption[] = [];
  let pending: ParsedOption | null = null;

  const flush = () => {
    if (!pending) return;
    pending.desc = pending.desc.trim();
    out.push(pending);
    pending = null;
  };

  for (const line of lines) {
    const m = line.match(OPTION_ROW_RE);
    if (m) {
      if (flagsOnly && m.groups?.val) continue;
      flush();
      pending = {
        short: m.groups?.short || undefined,
        long: m.groups!.long,
        desc: m.groups!.desc.trim(),
      };
      continue;
    }

    if (pending) {
      const indent = measureIndent(line);
      const startsNew = OPTION_HEAD_RE.test(line);
      if (indent >= descCol && line.trim() && !startsNew) {
        pending.desc += ' ' + line.trim();
      }
    }
  }
  flush();

  return out;
}

function loadPnpmOptionsSync(cmd: LazyCommand, command: string): void {
  const output = safeExecSync(`pnpm ${command} --help`);
  if (!output) return;

  const options = parsePnpmOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of options) {
    const exists = cmd.optionsRaw?.get?.(long);
    if (exists) continue;

    const handler = pnpmOptionHandlers[long];
    if (handler) cmd.option(long, desc, handler, short);
    else cmd.option(long, desc, short);
  }

  // Register options found by general algorithm but not in standard parsing
  for (const [optionName, handler] of Object.entries(pnpmOptionHandlers)) {
    if (!cmd.optionsRaw?.get?.(optionName)) {
      const values = extractValidValuesFromHelp(output, optionName);
      if (values.length > 0) {
        cmd.option(optionName, ' ', handler);
      }
    }
  }
}

export async function setupPnpmCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commands = await getPnpmCommandsFromMainHelp();

    for (const [command, description] of Object.entries(commands)) {
      const c = completion.command(command, description);
      setupCommandArguments(c, command, 'pnpm');
      setupLazyOptionLoading(c, command, 'pnpm', loadPnpmOptionsSync);
    }
  } catch {}
}
