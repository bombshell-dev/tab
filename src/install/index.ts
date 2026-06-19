import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBash, uninstallBash } from './bash';
import {
  makeContext,
  makeUninstallContext,
  type ShellInstaller,
  type ShellUninstaller,
} from './context';
import { detectName, detectShell, probePath } from './detect';
import { installFish, uninstallFish } from './fish';
import { installPowershell, uninstallPowershell } from './powershell';
import { formatResult, formatUninstallResult, shouldPrint, shouldPrintUninstall } from './print';
import type {
  InstallOptions,
  InstallResult,
  SupportedShell,
  UninstallOptions,
  UninstallResult,
} from './types';
import { installZsh, uninstallZsh } from './zsh';

export type {
  InstallOptions,
  InstallResult,
  UninstallOptions,
  UninstallResult,
} from './types';
export { formatResult, formatUninstallResult } from './print';

const INSTALLERS: Record<SupportedShell, ShellInstaller> = {
  zsh: installZsh,
  bash: installBash,
  fish: installFish,
  powershell: installPowershell,
};

const UNINSTALLERS: Record<SupportedShell, ShellUninstaller> = {
  zsh: uninstallZsh,
  bash: uninstallBash,
  fish: uninstallFish,
  powershell: uninstallPowershell,
};

let cachedVersion: string | undefined;
function getTabVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // walk up looking for our package.json
    let dir = here;
    for (let i = 0; i < 6; i++) {
      try {
        const pkg = JSON.parse(
          readFileSync(join(dir, 'package.json'), 'utf-8')
        );
        if (pkg.name === '@bomb.sh/tab' && typeof pkg.version === 'string') {
          cachedVersion = pkg.version as string;
          return cachedVersion;
        }
      } catch {
        // keep walking
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // ignore
  }
  cachedVersion = '0.0.0';
  return cachedVersion;
}

export async function installShellCompletions(
  options: InstallOptions = {}
): Promise<InstallResult> {
  const name = options.name ?? detectName();
  if (!name) {
    throw new Error(
      'installShellCompletions: could not detect CLI name; pass { name } explicitly.'
    );
  }
  const executable = options.executable ?? name;
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const verbose = options.verbose ?? false;
  const printSetting = options.print ?? 'on-error';

  const shell =
    options.shell && options.shell !== 'auto' ? options.shell : detectShell();

  if (!shell) {
    const result: InstallResult = {
      shell: 'bash',
      status: 'blocked',
      detected: {
        pathReachable: false,
        installMethod: 'unknown',
        shellEnv: {},
      },
      actions: [],
      userInstructions: [
        'Could not detect your shell. Pass `{ shell: "zsh" | "bash" | "fish" | "powershell" }` explicitly.',
      ],
      warnings: [],
      explanation: 'Shell detection failed.',
    };
    if (shouldPrint(result, printSetting)) {
      console.error(formatResult(result));
    }
    return result;
  }

  const path = probePath(name);

  const ctx = makeContext({
    name,
    executable,
    version: getTabVersion(),
    dryRun,
    force,
    verbose,
    detected: {
      pathReachable: path.reachable,
      resolvedPath: path.resolvedPath,
      installMethod: path.installMethod,
    },
  });

  let result: InstallResult;

  if (!path.reachable) {
    result = ctx.startResult(shell);
    result.status = 'blocked';
    result.explanation = `\`${name}\` is not on PATH from a fresh shell. Completions only work for globally-reachable commands.`;
    result.userInstructions.push(
      'Install the CLI globally (e.g. `npm i -g`, `brew install`, or place a standalone binary on PATH), then re-run.'
    );
  } else {
    const installer = INSTALLERS[shell];
    try {
      result = installer(ctx);
    } catch (err) {
      result = ctx.startResult(shell);
      result.status = 'failed';
      result.explanation = (err as Error).message;
    }
  }

  if (shouldPrint(result, printSetting)) {
    console.error(formatResult(result));
  }

  return result;
}

export async function uninstallShellCompletions(
  options: UninstallOptions = {}
): Promise<UninstallResult> {
  const name = options.name ?? detectName();
  if (!name) {
    throw new Error(
      'uninstallShellCompletions: could not detect CLI name; pass { name } explicitly.'
    );
  }
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const verbose = options.verbose ?? false;
  const printSetting = options.print ?? 'on-error';

  const shell =
    options.shell && options.shell !== 'auto' ? options.shell : detectShell();

  if (!shell) {
    const result: UninstallResult = {
      shell: 'bash',
      status: 'blocked',
      actions: [],
      warnings: [],
      explanation:
        'Could not detect your shell. Pass `{ shell: "zsh" | "bash" | "fish" | "powershell" }` explicitly.',
    };
    if (shouldPrintUninstall(result, printSetting)) {
      console.error(formatUninstallResult(result));
    }
    return result;
  }

  const ctx = makeUninstallContext({ name, dryRun, force, verbose });
  const uninstaller = UNINSTALLERS[shell];
  let result: UninstallResult;
  try {
    result = uninstaller(ctx);
  } catch (err) {
    result = ctx.startResult(shell);
    result.status = 'failed';
    result.explanation = (err as Error).message;
  }

  if (shouldPrintUninstall(result, printSetting)) {
    console.error(formatUninstallResult(result));
  }

  return result;
}
