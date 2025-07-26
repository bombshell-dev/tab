#!/usr/bin/env node

import cac from 'cac';
import { script, Completion } from '../src/index.js';
import tab from '../src/cac.js';

import { setupCompletionForPackageManager } from './completion-handlers';

const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];
const shells = ['zsh', 'bash', 'fish', 'powershell'];

async function main() {
  const cli = cac('tab');

  const args = process.argv.slice(2);
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
      const completion = new Completion();
      setupCompletionForPackageManager(packageManager, completion);
      const toComplete = process.argv.slice(dashIndex + 1);
      await completion.parse(toComplete);
      process.exit(0);
    } else {
      console.error(`Error: Expected '--' followed by command to complete`);
      console.error(
        `Example: ${packageManager} exec @bombsh/tab ${packageManager} complete -- command-to-complete`
      );
      process.exit(1);
    }
  }

  cli
    .command(
      '<packageManager> <shell>',
      'Generate shell completion script for a package manager'
    )
    .action(async (packageManager, shell) => {
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
    });

  const completion = tab(cli);

  cli.parse();
}

// function generateCompletionScript(packageManager: string, shell: string) {
//   const name = packageManager;
//   const executable = process.env.npm_execpath
//     ? `${packageManager} exec @bombsh/tab ${packageManager}`
//     : `node ${process.argv[1]} ${packageManager}`;
//   script(shell as any, name, executable);
// }

function generateCompletionScript(packageManager: string, shell: string) {
  const name = packageManager;
  // this always points at the actual file on disk (TESTING)
  const executable = `node ${process.argv[1]} ${packageManager}`;
  script(shell as any, name, executable);
}

main().catch(console.error);
