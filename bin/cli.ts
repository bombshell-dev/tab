#!/usr/bin/env node

import { script } from '../src/t.js';
import { setupCompletionForPackageManager } from './completion-handlers';
import { PackageManagerCompletion } from './package-manager-completion.js';

const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];
const shells = ['zsh', 'bash', 'fish', 'powershell'];

async function main() {
  const args = process.argv.slice(2);
  const isPowerShell = process.platform === 'win32' && process.env.PSModulePath;

  if (process.env.TAB_DEBUG) {
    console.error('RAW ARGS:', process.argv);
  }

  // <packageManager> complete -- <args>
  if (args.length >= 2 && args[1] === 'complete') {
    const packageManager = args[0];

    if (!packageManagers.includes(packageManager)) {
      console.error(`Error: Unsupported package manager "${packageManager}"`);
      console.error(
        `Supported package managers: ${packageManagers.join(', ')}`
      );
      process.exit(1);
    }

    const dashIndex = process.argv.indexOf('--');
    // When PowerShell shims drop the literal '--', fall back to treating
    // everything after "complete" as the completion payload.
    const completionArgs =
      dashIndex !== -1
        ? process.argv.slice(dashIndex + 1)
        : isPowerShell
          ? args.slice(2)
          : null;

    if (!completionArgs) {
      console.error(`Error: Expected '--' followed by command to complete`);
      process.exit(1);
    }

    const completion = new PackageManagerCompletion(packageManager);
    await setupCompletionForPackageManager(packageManager, completion);
    await completion.parse(completionArgs);
    process.exit(0);
  }

  // <packageManager> <shell>
  if (args.length === 2) {
    const [packageManager, shell] = args;

    if (!packageManagers.includes(packageManager)) {
      console.error(`Error: Unsupported package manager "${packageManager}"`);
      console.error(
        `Supported package managers: ${packageManagers.join(', ')}`
      );
      process.exit(1);
    }

    if (!shells.includes(shell)) {
      console.error(`Error: Unsupported shell "${shell}"`);
      console.error(`Supported shells: ${shells.join(', ')}`);
      process.exit(1);
    }

    generateCompletionScript(packageManager, shell);
    process.exit(0);
  }

  console.error('Usages: tab <packageManager> <shell>');
  console.error(`       tab <packageManager> complete -- <args>`);
  process.exit(1);
}

function generateCompletionScript(packageManager: string, shell: string) {
  const name = packageManager;
  console.log(process.argv);


  const isLocalDev = process.argv[1].endsWith('dist/bin/cli.js');

  const executable = isLocalDev
    ? `node ${process.argv[1]} ${packageManager}`
    : `tab ${packageManager}`;

  script(shell as any, name, executable);
}

main().catch(console.error);
