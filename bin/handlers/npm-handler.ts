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
} from '../utils/shared.js';

const ALL_COMMANDS_RE = /^All commands:\s*$/i;
const OPTIONS_SECTION_RE = /^Options:\s*$/i;
const SECTION_END_RE = /^(aliases|run|more)/i; // marks end of Options: block
const COMMAND_VALIDATION_RE = /^[a-z][a-z0-9-]*$/;
const NPM_OPTION_RE =
  /(?:\[)?(?:-([a-z])\|)?--([a-z][a-z0-9-]+)(?:\s+<[^>]+>)?(?:\])?/gi;
const ANGLE_VALUE_RE = /<[^>]+>/;
const INDENTED_LINE_RE = /^\s/;

function toLines(helpText: string): string[] {
  return stripAnsiEscapes(helpText).split(/\r?\n/);
}

function readIndentedBlockAfter(lines: string[], headerRe: RegExp): string {
  const start = lines.findIndex((l) => headerRe.test(l.trim()));
  if (start === -1) return '';

  let buf = '';
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!INDENTED_LINE_RE.test(line) && line.trim() && !line.includes(','))
      break;
    if (INDENTED_LINE_RE.test(line)) buf += ' ' + line.trim();
  }
  return buf;
}

const listHandler =
  (values: string[], describe: (v: string) => string = () => ' ') =>
  (complete: (value: string, description: string) => void) =>
    values.forEach((v) => complete(v, describe(v)));

const npmOptionHandlers: OptionHandlers = {
  ...commonOptionHandlers,

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

  'install-strategy': listHandler(
    ['hoisted', 'nested', 'shallow', 'linked'],
    (v) =>
      (
        ({
          hoisted: 'Hoist all dependencies to top level',
          nested: 'Nested node_modules structure',
          shallow: 'Shallow dependency installation',
          linked: 'Use linked dependencies',
        }) as Record<string, string>
      )[v] ?? ' '
  ),

  omit: listHandler(
    ['dev', 'optional', 'peer'],
    (v) =>
      (
        ({
          dev: 'Omit devDependencies',
          optional: 'Omit optionalDependencies',
          peer: 'Omit peerDependencies',
        }) as Record<string, string>
      )[v] ?? ' '
  ),

  include: listHandler(
    ['prod', 'dev', 'optional', 'peer'],
    (v) =>
      (
        ({
          prod: 'Include production deps',
          dev: 'Include dev deps',
          optional: 'Include optional deps',
          peer: 'Include peer deps',
        }) as Record<string, string>
      )[v] ?? ' '
  ),
};

export function parseNpmHelp(helpText: string): Record<string, string> {
  const lines = toLines(helpText);
  const commandsBlob = readIndentedBlockAfter(lines, ALL_COMMANDS_RE);
  if (!commandsBlob) return {};

  const commands: Record<string, string> = {};

  commandsBlob
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && COMMAND_VALIDATION_RE.test(c))
    .forEach((cmd) => {
      // npm main help has no per-command descriptions
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

export function parseNpmOptions(
  helpText: string,
  { flagsOnly = true }: { flagsOnly?: boolean } = {}
): ParsedOption[] {
  const lines = toLines(helpText);

  const start = lines.findIndex((l) => OPTIONS_SECTION_RE.test(l.trim()));
  if (start === -1) return [];

  const out: ParsedOption[] = [];

  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (SECTION_END_RE.test(trimmed)) break;

    const matches = line.matchAll(NPM_OPTION_RE);
    for (const m of matches) {
      const short = m[1] || undefined;
      const long = m[2];
      const takesValue = ANGLE_VALUE_RE.test(m[0]);
      if (flagsOnly && takesValue) continue;

      out.push({ short, long, desc: ' ' });
    }
  }

  return out;
}

function loadNpmOptionsSync(cmd: LazyCommand, command: string): void {
  const output = safeExecSync(`npm ${command} --help`);
  if (!output) return;

  const allOptions = parseNpmOptions(output, { flagsOnly: false });

  for (const { long, short, desc } of allOptions) {
    const exists = cmd.optionsRaw?.get?.(long);
    if (exists) continue;

    const handler = npmOptionHandlers[long];
    if (handler) cmd.option(long, desc, handler, short);
    else cmd.option(long, desc, short);
  }
}

export async function setupNpmCompletions(
  completion: PackageManagerCompletion
): Promise<void> {
  try {
    const commands = await getNpmCommandsFromMainHelp();
    for (const [command, description] of Object.entries(commands)) {
      const c = completion.command(command, description);

      setupCommandArguments(c, command, 'npm');

      setupLazyOptionLoading(c, command, 'npm', loadNpmOptionsSync);
    }
  } catch {}
}
