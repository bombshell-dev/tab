/**
 * Main entry point for package manager completion handlers
 * Delegates to specific package manager handlers
 */

import type { PackageManagerCompletion } from './package-manager-completion.js';
import { setupPnpmCompletions } from './handlers/pnpm-handler.js';
import { setupNpmCompletions } from './handlers/npm-handler.js';
import { setupYarnCompletions } from './handlers/yarn-handler.js';
import { setupBunCompletions } from './handlers/bun-handler.js';

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
