import { Handler, Completion } from './index';

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

export type TabFunction<T> = (
  instance: T,
  completionConfig?: CompletionConfig
) => Promise<Completion>;
