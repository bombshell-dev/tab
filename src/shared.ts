import { OptionHandler, ArgumentHandler } from './t';

export const noopHandler: OptionHandler = function() {
  // No-op handler for options
};

// TODO (43081j): use type inference some day, so we can type-check
// that the sub commands exist, the options exist, etc.
export interface CompletionConfig {
  subCommands?: Record<string, CompletionConfig>;
  options?: Record<string, OptionHandler>;
  args?: Record<string, ArgumentHandler>;
}

export function assertDoubleDashes(programName: string = 'cli'): void {
  const dashDashIndex = process.argv.indexOf('--');

  if (dashDashIndex === -1) {
    const errorMessage = `Error: You need to use -- to separate completion arguments.\nExample: ${programName} complete -- <args>`;
    console.error(errorMessage);
    process.exit(1);
  }
}
