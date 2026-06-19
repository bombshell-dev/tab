import { existsSync } from 'node:fs';
import type {
  InstallMethod,
  InstallResult,
  SupportedShell,
  UninstallResult,
} from './types';

export type InstallContext = {
  name: string;
  executable: string;
  version: string;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  detected: {
    pathReachable: boolean;
    resolvedPath?: string;
    installMethod: InstallMethod;
  };
  startResult: (shell: SupportedShell) => InstallResult;
  fileExists: (path: string) => boolean;
  log: (msg: string) => void;
};

export type ShellInstaller = (ctx: InstallContext) => InstallResult;

export type UninstallContext = {
  name: string;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  startResult: (shell: SupportedShell) => UninstallResult;
  fileExists: (path: string) => boolean;
  log: (msg: string) => void;
};

export type ShellUninstaller = (ctx: UninstallContext) => UninstallResult;

export function makeUninstallContext(input: {
  name: string;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
}): UninstallContext {
  return {
    ...input,
    startResult: (shell) => ({
      shell,
      status: 'not-installed',
      actions: [],
      warnings: [],
    }),
    fileExists: (p) => existsSync(p),
    log: (msg) => {
      if (input.verbose) {
        console.error(`[tab/uninstall] ${msg}`);
      }
    },
  };
}

export function makeContext(input: {
  name: string;
  executable: string;
  version: string;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  detected: InstallContext['detected'];
}): InstallContext {
  return {
    ...input,
    startResult: (shell) => ({
      shell,
      status: 'installed',
      detected: {
        pathReachable: input.detected.pathReachable,
        resolvedPath: input.detected.resolvedPath,
        installMethod: input.detected.installMethod,
        shellEnv: {},
      },
      actions: [],
      userInstructions: [],
      warnings: [],
    }),
    fileExists: (p) => existsSync(p),
    log: (msg) => {
      if (input.verbose) {
        console.error(`[tab/install] ${msg}`);
      }
    },
  };
}
