import { promisify } from 'node:util';
import child_process from 'node:child_process';

export const exec = promisify(child_process.exec);
export const { execSync } = child_process;

import { Command, Option } from '../../src/t.js';
import {
  packageJsonScriptCompletion,
  packageJsonDependencyCompletion,
} from '../completions/completion-producers.js';
import { getWorkspacePatterns } from './filesystem-utils.js';

export interface LazyCommand extends Command {
  _lazyCommand?: string;
  _optionsLoaded?: boolean;
  optionsRaw?: Map<string, Option>;
}

export type CompletionHandler = (
  complete: (value: string, description: string) => void
) => void;
export type OptionHandlers = Record<string, CompletionHandler>;

export const commonOptionHandlers: OptionHandlers = {
  workspace(complete) {
    const patterns = getWorkspacePatterns();
    patterns.forEach((p) => complete(p, `Workspace pattern: ${p}`));
    complete('packages/*', 'All packages in packages directory');
    complete('apps/*', 'All apps in apps directory');
  },

  registry(complete) {
    complete('https://registry.npmjs.org/', 'Official npm registry');
    complete('https://registry.npmmirror.com/', 'npm China mirror');
  },
};

export function setupLazyOptionLoading(
  cmd: LazyCommand,
  command: string,
  _packageManager: string,
  loadOptionsSync: (cmd: LazyCommand, command: string) => void
): void {
  cmd._lazyCommand = command;
  cmd._optionsLoaded = false;

  const store = cmd.options;
  cmd.optionsRaw = store;

  Object.defineProperty(cmd, 'options', {
    get() {
      if (!this._optionsLoaded) {
        this._optionsLoaded = true;
        loadOptionsSync(this, this._lazyCommand);
      }
      return store;
    },
    configurable: true,
  });
}

export function setupCommandArguments(
  cmd: LazyCommand,
  command: string,
  _packageManager: string
): void {
  if (['remove', 'rm', 'uninstall', 'un', 'update', 'up'].includes(command)) {
    cmd.argument('package', packageJsonDependencyCompletion);
  }

  if (['run', 'run-script'].includes(command)) {
    cmd.argument('script', packageJsonScriptCompletion, true);
  }
}

export async function safeExec(
  command: string,
  options: any = {}
): Promise<string> {
  try {
    const { stdout } = await exec(command, {
      encoding: 'utf8' as const,
      timeout: 500,
      maxBuffer: 4 * 1024 * 1024,
      ...options,
    });
    return stdout as unknown as string;
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return (error as any).stdout as string;
    }
    return '';
  }
}

export function safeExecSync(command: string, options: any = {}): string {
  try {
    return execSync(command, {
      encoding: 'utf8' as const,
      timeout: 500,
      ...options,
    }) as unknown as string;
  } catch (error: any) {
    return error?.stdout ? (error.stdout as string) : '';
  }
}

export function createLogLevelHandler(levels: string[]): CompletionHandler {
  return (complete) => levels.forEach((lvl) => complete(lvl, ' '));
}
