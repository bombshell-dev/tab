import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import * as bash from '../bash';
import type { ShellInstaller, ShellUninstaller } from './context';
import { detectBashCompletion } from './detect';
import { inspectFile, makeFileMarker } from './markers';

function bashTarget(name: string): string {
  const xdg = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  return join(xdg, 'bash-completion', 'completions', name);
}

function bashCompletionInstallHint(): string {
  if (platform() === 'darwin') {
    return [
      'Install bash-completion (macOS default bash has none):',
      '  brew install bash-completion@2',
      'Then add to your ~/.bash_profile:',
      '  [[ -r "$(brew --prefix)/etc/profile.d/bash_completion.sh" ]] && . "$(brew --prefix)/etc/profile.d/bash_completion.sh"',
    ].join('\n    ');
  }
  return [
    'Install bash-completion via your package manager:',
    '  apt install bash-completion       # Debian/Ubuntu',
    '  dnf install bash-completion       # Fedora',
    '  pacman -S bash-completion         # Arch',
    'Then start a new shell.',
  ].join('\n    ');
}

export const installBash: ShellInstaller = (ctx) => {
  const result = ctx.startResult('bash');
  const target = bashTarget(ctx.name);

  const bc = detectBashCompletion();
  ctx.log(`bash-completion present: ${bc.present}`);

  result.detected.shellEnv = {
    bashCompletionPresent: bc.present,
    bashCompletionLoader: bc.loaderPath,
    targetDir: dirname(target),
  };

  const existing = inspectFile(target);
  if (existing.managedByTab && existing.version === ctx.version && bc.present) {
    result.status = 'already-installed';
    result.actions.push({ type: 'write-file', path: target, performed: false });
    return result;
  }
  if (!existing.managedByTab && ctx.fileExists(target) && !ctx.force) {
    result.status = 'blocked';
    result.explanation = `An unmanaged completion file already exists at ${target}.`;
    result.userInstructions.push(
      `Remove ${target} and re-run, or pass { force: true } to overwrite.`
    );
    return result;
  }

  const marker = makeFileMarker(ctx.name, ctx.version, '#');
  const script = `${marker}\n${bash.generate(ctx.name, ctx.executable)}`;

  if (!ctx.dryRun) {
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, script);
    } catch (err) {
      result.status = 'blocked';
      result.explanation = `Failed to write completion file: ${(err as Error).message}`;
      return result;
    }
  }
  result.actions.push({
    type: 'write-file',
    path: target,
    performed: !ctx.dryRun,
  });

  if (!bc.present) {
    result.status = 'needs-user-action';
    result.userInstructions.push(bashCompletionInstallHint());
    return result;
  }

  result.status = existing.managedByTab ? 'updated' : 'installed';
  result.userInstructions.push(
    'Restart your shell or run `exec bash` to load the new completions.'
  );
  return result;
};

export const uninstallBash: ShellUninstaller = (ctx) => {
  const result = ctx.startResult('bash');
  const target = bashTarget(ctx.name);

  if (!ctx.fileExists(target)) return result;

  const info = inspectFile(target);
  if (!info.managedByTab && !ctx.force) {
    result.status = 'blocked';
    result.explanation = `${target} exists but was not written by tab; refusing to remove.`;
    return result;
  }

  if (!ctx.dryRun) {
    try {
      rmSync(target);
    } catch (err) {
      result.status = 'failed';
      result.explanation = (err as Error).message;
      return result;
    }
  }
  result.actions.push({ type: 'remove-file', path: target, performed: !ctx.dryRun });
  result.status = 'uninstalled';
  return result;
};
