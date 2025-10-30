#!/usr/bin/env node

import { script } from '../src/t.js';
import { setupCompletionForPackageManager } from './completion-handlers';
import { PackageManagerCompletion } from './package-manager-completion.js';

const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];
const shells = ['zsh', 'bash', 'fish', 'powershell'];

async function main() {
  const args = process.argv.slice(2);

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
      console.error(`Error: Expected '--' followed by command to complete`);
      process.exit(1);
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

  console.error('Usage: tab <packageManager> <shell>');
  console.error(`       tab <packageManager> complete -- <args>`);
  process.exit(1);
}

function generateCompletionScript(packageManager: string, shell: string) {
  const name = packageManager;
  const executable = process.env.npm_config_user_agent
    ? `npx --yes @bomb.sh/tab ${packageManager}`
    : `node ${process.argv[1]} ${packageManager}`;
  script(shell as any, name, executable);
}

main().catch(console.error);
