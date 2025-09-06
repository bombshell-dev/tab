// regex for parsing help text
export const ANSI_ESCAPE_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// Command row: <indent><names><>=2 spaces><desc>
// e.g. "  install, i        Install all dependencies"
export const COMMAND_ROW_RE = /^\s+([a-z][a-z\s,-]*?)\s{2,}(\S.*)$/i;

// Option row (optional value part captured in (?<val>)):
// [indent][-x, ]--long[ <value>| [value]]  <>=2 spaces>  <desc>
export const OPTION_ROW_RE =
  /^\s*(?:-(?<short>[A-Za-z]),\s*)?--(?<long>[a-z0-9-]+)(?<val>\s+(?:<[^>]+>|\[[^\]]+\]))?\s{2,}(?<desc>\S.*)$/i;

// we detect the start of a new option head (used to stop continuation)
export const OPTION_HEAD_RE = /^\s*(?:-[A-Za-z],\s*)?--[a-z0-9-]+/i;

// we remove the ANSI escape sequences from a string
export const stripAnsiEscapes = (s: string): string =>
  s.replace(ANSI_ESCAPE_RE, '');

// measure the indentation level of a string
export const measureIndent = (s: string): number =>
  (s.match(/^\s*/) || [''])[0].length;

// parse a comma-separated list of aliases
export const parseAliasList = (s: string): string[] =>
  s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export type ParsedOption = {
  long: string;
  short?: string;
  desc: string;
};
