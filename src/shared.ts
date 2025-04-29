import { Handler } from './index';

export const noopHandler: Handler = () => {
  return [];
};

// TODO (43081j): use type inference some day, so we can type-check
// that the sub commands exist, the options exist, etc.
export interface CompletionConfig {
  handler?: Handler;
  subCommands?: Record<string, CompletionConfig>;
  options?: Record<
    string,
    {
      handler: Handler;
    }
  >;
}

export function assertDoubleDashes(programName: string = 'cli'): void {
  const dashDashIndex = process.argv.indexOf('--');

  if (dashDashIndex === -1) {
    const errorMessage = `Error: You need to use -- to separate completion arguments.\nExample: ${programName} complete -- <args>`;
    console.error(errorMessage);
  }
}
