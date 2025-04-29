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

export function requireDashDashSeparator(programName: string): boolean {
  const dashDashIndex = process.argv.indexOf('--');
  const wasDashDashProvided = dashDashIndex !== -1;

  if (!wasDashDashProvided) {
    console.error('Error: You need to use -- to separate completion arguments');
  }

  return wasDashDashProvided;
}
