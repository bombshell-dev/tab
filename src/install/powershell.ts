import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import * as powershell from '../powershell';
import type { ShellInstaller, ShellUninstaller } from './context';
import {
  powershellExecutionPolicy,
  powershellProfilePath,
} from './detect';
import {
  fileContainsBlock,
  inspectFile,
  makeFileMarker,
  removeBlock,
  upsertBlock,
  wrapBlock,
} from './markers';

export const installPowershell: ShellInstaller = (ctx) => {
  const result = ctx.startResult('powershell');
  const profile = powershellProfilePath();

  if (!profile) {
    result.status = 'blocked';
    result.explanation = 'Could not locate PowerShell. Is pwsh installed and on PATH?';
    return result;
  }

  const policy = powershellExecutionPolicy();
  ctx.log(`pwsh profile: ${profile}`);
  ctx.log(`pwsh execution policy: ${policy}`);

  result.detected.shellEnv = {
    profilePath: profile,
    executionPolicy: policy,
  };

  // The completion script itself; we wrap it in a sentinel block since we're
  // appending to a shared profile file.
  const block = wrapBlock(
    ctx.name,
    `${makeFileMarker(ctx.name, ctx.version, '#')}\n${powershell.generate(ctx.name, ctx.executable)}`,
    '#'
  );

  let existingContent = '';
  if (ctx.fileExists(profile)) {
    try {
      existingContent = readFileSync(profile, 'utf-8');
    } catch (err) {
      result.status = 'blocked';
      result.explanation = `Failed to read ${profile}: ${(err as Error).message}`;
      return result;
    }
  }

  const alreadyHasBlock = fileContainsBlock(profile, ctx.name, '#');
  const markerInfo = inspectFile(profile);

  if (
    alreadyHasBlock &&
    markerInfo.managedByTab &&
    markerInfo.version === ctx.version
  ) {
    result.status = 'already-installed';
    result.actions.push({
      type: 'append-file',
      path: profile,
      performed: false,
    });
  } else {
    const newContent = upsertBlock(existingContent, ctx.name, block, '#');

    if (!ctx.dryRun) {
      try {
        mkdirSync(dirname(profile), { recursive: true });
        writeFileSync(profile, newContent);
      } catch (err) {
        result.status = 'blocked';
        result.explanation = `Failed to write profile: ${(err as Error).message}`;
        return result;
      }
    }
    result.actions.push({
      type: alreadyHasBlock ? 'append-file' : ctx.fileExists(profile) ? 'append-file' : 'write-file',
      path: profile,
      performed: !ctx.dryRun,
    });
    result.status = alreadyHasBlock ? 'updated' : 'installed';
  }

  if (policy && /^Restricted$/i.test(policy)) {
    result.status = 'needs-user-action';
    result.userInstructions.push(
      'Your PowerShell execution policy is Restricted, which blocks profile scripts.',
      'Run this once in an admin or user PowerShell session:',
      '  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned'
    );
  } else if (result.status === 'installed' || result.status === 'updated') {
    result.userInstructions.push(
      'Start a new PowerShell session to load the completions.'
    );
  }

  return result;
};

export const uninstallPowershell: ShellUninstaller = (ctx) => {
  const result = ctx.startResult('powershell');
  const profile = powershellProfilePath();

  if (!profile || !ctx.fileExists(profile)) {
    return result;
  }

  if (!fileContainsBlock(profile, ctx.name, '#')) {
    return result;
  }

  let content: string;
  try {
    content = readFileSync(profile, 'utf-8');
  } catch (err) {
    result.status = 'failed';
    result.explanation = (err as Error).message;
    return result;
  }

  const updated = removeBlock(content, ctx.name, '#');

  if (!ctx.dryRun) {
    try {
      writeFileSync(profile, updated);
    } catch (err) {
      result.status = 'failed';
      result.explanation = (err as Error).message;
      return result;
    }
  }
  result.actions.push({
    type: 'remove-block',
    path: profile,
    performed: !ctx.dryRun,
  });
  result.status = 'uninstalled';
  return result;
};
