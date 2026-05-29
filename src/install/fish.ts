import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as fish from '../fish';
import type { ShellInstaller, ShellUninstaller } from './context';
import { inspectFile, makeFileMarker } from './markers';

function fishTarget(name: string): string {
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdg, 'fish', 'completions', `${name}.fish`);
}

export const installFish: ShellInstaller = (ctx) => {
  const result = ctx.startResult('fish');
  const target = fishTarget(ctx.name);

  const existing = inspectFile(target);
  if (existing.managedByTab && existing.version === ctx.version) {
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
  const script = `${marker}\n${fish.generate(ctx.name, ctx.executable)}`;

  if (!ctx.dryRun) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, script);
  }
  result.actions.push({ type: 'write-file', path: target, performed: !ctx.dryRun });
  result.status = existing.managedByTab ? 'updated' : 'installed';
  return result;
};

export const uninstallFish: ShellUninstaller = (ctx) => {
  const result = ctx.startResult('fish');
  const target = fishTarget(ctx.name);

  if (!ctx.fileExists(target)) {
    return result;
  }

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
