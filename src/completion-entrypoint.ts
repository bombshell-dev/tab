export type CompletionEntrypoint = readonly string[];

export interface ScriptOptions {
  readonly completionEntrypoint?: CompletionEntrypoint;
}

export const DEFAULT_COMPLETION_ENTRYPOINT = ['complete', '--'] as const;

const SAFE_POSIX_ARG = /^[A-Za-z0-9_./:=+-]+$/;
const SAFE_POWERSHELL_ARG = /^[A-Za-z0-9_./:=+-]+$/;

function quotePosixArg(value: string): string {
  if (value !== '' && SAFE_POSIX_ARG.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quotePowerShellArg(value: string): string {
  if (value !== '--' && value !== '' && SAFE_POWERSHELL_ARG.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `''`)}'`;
}

export function getCompletionEntrypoint(
  options: ScriptOptions = {}
): CompletionEntrypoint {
  return options.completionEntrypoint ?? DEFAULT_COMPLETION_ENTRYPOINT;
}

export function formatCompletionEntrypointForShell(
  options: ScriptOptions = {}
): string {
  return getCompletionEntrypoint(options).map(quotePosixArg).join(' ');
}

export function formatCompletionEntrypointForPowerShell(
  options: ScriptOptions = {}
): string {
  return getCompletionEntrypoint(options).map(quotePowerShellArg).join(' ');
}
