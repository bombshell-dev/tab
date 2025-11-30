#!/usr/bin/env node

import { script } from '../src/t.js';
import { setupCompletionForPackageManager } from './completion-handlers';
import { PackageManagerCompletion } from './package-manager-completion.js';

const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];
const shells = ['zsh', 'bash', 'fish', 'powershell'];

async function main() {
  const args = process.argv.slice(2);

  if (process.env.TAB_DEBUG) {
  console.error("RAW ARGS:", process.argv);
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
    if (dashIndex !== -1) {
      const completion = new PackageManagerCompletion(packageManager);
      await setupCompletionForPackageManager(packageManager, completion);
      const toComplete = process.argv.slice(dashIndex + 1);
      await completion.parse(toComplete);
      process.exit(0);
    } else {
      // Handle PowerShell case where trailing '--' gets stripped by npm.cmd
      // In PowerShell, args after 'complete' should be treated as completion args
      const isPowerShell = process.platform === 'win32' && process.env.PSModulePath;
      if (isPowerShell) {
        const completion = new PackageManagerCompletion(packageManager);
        await setupCompletionForPackageManager(packageManager, completion);
        // Take args after 'complete' (args[2..]) as the completion args
        const toComplete = args.slice(2);
        await completion.parse(toComplete);
        process.exit(0);
      } else {
        console.error(`Error: Expected '--' followed by command to complete`);
        process.exit(1);
      }
    }
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
