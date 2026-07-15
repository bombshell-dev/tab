import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as zsh from '../zsh';
import type { ShellInstaller, ShellUninstaller } from './context';
import {
  brewPrefix,
  detectZshFpath,
  zshrcHasCompinit,
} from './detect';
import { inspectFile, makeFileMarker } from './markers';

function isWritableDir(p: string): boolean {
  try {
    accessSync(p, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

type ZshTarget = {
  dir: string;
  /** True if the dir is already in the user's $fpath. */
  inFpath: boolean;
};

function pickZshTargetDir(fpath: string[]): ZshTarget {
  const writableFromFpath = fpath.find(isWritableDir);
  if (writableFromFpath) {
    return { dir: writableFromFpath, inFpath: true };
  }

  const brew = brewPrefix();
  if (brew) {
    const brewSiteFunctions = join(brew, 'share', 'zsh', 'site-functions');
    if (isWritableDir(brewSiteFunctions) || fpath.includes(brewSiteFunctions)) {
      return { dir: brewSiteFunctions, inFpath: fpath.includes(brewSiteFunctions) };
    }
  }

  return { dir: join(homedir(), '.zsh', 'completions'), inFpath: false };
}

export const installZsh: ShellInstaller = (ctx) => {
  const result = ctx.startResult('zsh');
  const fpath = detectZshFpath();
  const hasCompinit = zshrcHasCompinit() || fpath.length > 0;
  const target = pickZshTargetDir(fpath);
  const filePath = join(target.dir, `_${ctx.name}`);

  ctx.log(`zsh fpath has ${fpath.length} entries`);
  ctx.log(`zsh target dir: ${target.dir} (in fpath: ${target.inFpath})`);

  result.detected.shellEnv = {
    fpathDirCount: fpath.length,
    targetDir: target.dir,
    targetInFpath: target.inFpath,
    hasCompinit,
  };

  const existing = inspectFile(filePath);
  if (existing.managedByTab && existing.version === ctx.version && target.inFpath && hasCompinit) {
    result.status = 'already-installed';
    result.actions.push({ type: 'write-file', path: filePath, performed: false });
    return result;
  }
  if (!existing.managedByTab && ctx.fileExists(filePath) && !ctx.force) {
    result.status = 'blocked';
    result.explanation = `An unmanaged completion file already exists at ${filePath}.`;
    result.userInstructions.push(
      `Remove ${filePath} and re-run, or pass { force: true } to overwrite.`
    );
    return result;
  }

  const marker = makeFileMarker(ctx.name, ctx.version, '#');
  const script = `${marker}\n${zsh.generate(ctx.name, ctx.executable)}`;

  if (!ctx.dryRun) {
    try {
      mkdirSync(target.dir, { recursive: true });
      writeFileSync(filePath, script);
    } catch (err) {
      result.status = 'blocked';
      result.explanation = `Failed to write completion file: ${(err as Error).message}`;
      result.userInstructions.push(
        `The target directory ${target.dir} is not writable. Try running with sudo, or pick a user-writable fpath dir.`
      );
      return result;
    }
  }
  result.actions.push({
    type: 'write-file',
    path: filePath,
    performed: !ctx.dryRun,
  });

  const needsActions: string[] = [];
  if (!target.inFpath) {
    needsActions.push(
      `Add this line to your ~/.zshrc (before \`compinit\`):\n    fpath=(${target.dir} $fpath)`
    );
  }
  if (!hasCompinit) {
    needsActions.push(
      `Add this line to your ~/.zshrc:\n    autoload -U compinit && compinit`
    );
  }

  if (needsActions.length > 0) {
    result.status = 'needs-user-action';
    result.userInstructions.push(...needsActions);
    result.userInstructions.push('Then restart your shell or run `exec zsh`.');
  } else {
    result.status = existing.managedByTab ? 'updated' : 'installed';
    result.userInstructions.push(
      'Restart your shell or run `exec zsh` to load the new completions.'
    );
  }

  // Warn on the well-known Homebrew double-install case.
  const brew = brewPrefix();
  if (brew) {
    const brewFile = join(brew, 'share', 'zsh', 'site-functions', `_${ctx.name}`);
    if (brewFile !== filePath && ctx.fileExists(brewFile)) {
      result.warnings.push(
        `A Homebrew-installed completion exists at ${brewFile} and may shadow this one depending on fpath order.`
      );
    }
  }

  return result;
};

/**
 * Enumerate every place we might have installed a zsh completion for `name`.
 * Returns absolute paths to a `_<name>` file in each candidate dir, regardless
 * of whether the file actually exists.
 */
function zshCandidatePaths(name: string): string[] {
  const candidates: string[] = [];
  for (const dir of detectZshFpath()) {
    candidates.push(join(dir, `_${name}`));
  }
  const brew = brewPrefix();
  if (brew) {
    candidates.push(join(brew, 'share', 'zsh', 'site-functions', `_${name}`));
  }
  candidates.push(join(homedir(), '.zsh', 'completions', `_${name}`));
  return Array.from(new Set(candidates));
}

export const uninstallZsh: ShellUninstaller = (ctx) => {
  const result = ctx.startResult('zsh');
  const candidates = zshCandidatePaths(ctx.name);
  ctx.log(`zsh candidate paths: ${candidates.length}`);

  let removedAny = false;
  for (const filePath of candidates) {
    if (!ctx.fileExists(filePath)) continue;

    const info = inspectFile(filePath);
    if (!info.managedByTab && !ctx.force) {
      result.warnings.push(
        `Skipping ${filePath} — not written by tab. Pass { force: true } to remove anyway.`
      );
      continue;
    }

    if (!ctx.dryRun) {
      try {
        rmSync(filePath);
      } catch (err) {
        result.warnings.push(
          `Failed to remove ${filePath}: ${(err as Error).message}`
        );
        continue;
      }
    }
    result.actions.push({
      type: 'remove-file',
      path: filePath,
      performed: !ctx.dryRun,
    });
    removedAny = true;
  }

  if (removedAny) {
    result.status = 'uninstalled';
  } else if (result.warnings.length > 0) {
    result.status = 'blocked';
    result.explanation = 'Found completion files we did not manage. See warnings.';
  }
  return result;
};
