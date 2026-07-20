/**
 * Main entry point for package manager completion handlers
 * Delegates to specific package manager handlers
 */

import type { PackageManagerCompletion } from './package-manager-completion.js';
import {
  setupPnpmCompletions,
  getPnpmCommandsFromMainHelp,
} from './handlers/pnpm-handler.js';
import {
  setupNpmCompletions,
  getNpmCommandsFromMainHelp,
} from './handlers/npm-handler.js';
import {
  setupYarnCompletions,
  getYarnCommandsFromMainHelp,
} from './handlers/yarn-handler.js';
import {
  setupBunCompletions,
  getBunCommandsFromMainHelp,
} from './handlers/bun-handler.js';

/**
 * Return just the package manager's own command names (cached), without
 * building the full command tree. Used on the delegation hot path to decide
 * whether the first token is a package-manager command (complete it ourselves)
 * or an unknown sub-CLI (delegate to it) — cheaply, without re-parsing
 * `<pm> --help` on every keystroke.
 */
export async function getPackageManagerCommands(
  packageManager: string
): Promise<Record<string, string>> {
  switch (packageManager) {
    case 'pnpm':
      return getPnpmCommandsFromMainHelp();
    case 'npm':
      return getNpmCommandsFromMainHelp();
    case 'yarn':
      return getYarnCommandsFromMainHelp();
    case 'bun':
      return getBunCommandsFromMainHelp();
    default:
      return {};
  }
}

export async function setupCompletionForPackageManager(
  packageManager: string,
  completion: PackageManagerCompletion
): Promise<void> {
  switch (packageManager) {
    case 'pnpm':
      await setupPnpmCompletions(completion);
      break;
    case 'npm':
      await setupNpmCompletions(completion);
      break;
    case 'yarn':
      await setupYarnCompletions(completion);
      break;
    case 'bun':
      await setupBunCompletions(completion);
      break;
    default:
      // silently ignore unknown package managers
      break;
  }
}
