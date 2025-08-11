// TODO: i do not see any completion functionality in this file. nothing is being provided for the defined commands of these package managers. this is a blocker for release. every each of them should be handled.
import { PackageManagerCompletion } from './package-manager-completion.js';

export function setupCompletionForPackageManager(
  packageManager: string,
  completion: PackageManagerCompletion
) {
  if (packageManager === 'pnpm') {
    setupPnpmCompletions(completion);
  } else if (packageManager === 'npm') {
    setupNpmCompletions(completion);
  } else if (packageManager === 'yarn') {
    setupYarnCompletions(completion);
  } else if (packageManager === 'bun') {
    setupBunCompletions(completion);
  }

  // Note: Package manager logic is now handled by PackageManagerCompletion wrapper
}

export function setupPnpmCompletions(completion: PackageManagerCompletion) {
  completion.command('add', 'Install a package');
  completion.command('remove', 'Remove a package');
  completion.command('install', 'Install dependencies');
  completion.command('update', 'Update dependencies');
  completion.command('run', 'Run a script');
  completion.command('exec', 'Execute a command');
  completion.command('dlx', 'Run a package without installing');
  completion.command('create', 'Create a new project');
  completion.command('init', 'Initialize a new project');
  completion.command('publish', 'Publish the package');
  completion.command('pack', 'Create a tarball');
  completion.command('link', 'Link a package');
  completion.command('unlink', 'Unlink a package');
  completion.command('outdated', 'Check for outdated packages');
  completion.command('audit', 'Run security audit');
  completion.command('list', 'List installed packages');
}

export function setupNpmCompletions(completion: PackageManagerCompletion) {
  completion.command('install', 'Install a package');
  completion.command('uninstall', 'Remove a package');
  completion.command('update', 'Update dependencies');
  completion.command('run', 'Run a script');
  completion.command('exec', 'Execute a command');
  completion.command('init', 'Initialize a new project');
  completion.command('publish', 'Publish the package');
  completion.command('pack', 'Create a tarball');
  completion.command('link', 'Link a package');
  completion.command('unlink', 'Unlink a package');
}

export function setupYarnCompletions(completion: PackageManagerCompletion) {
  completion.command('add', 'Install a package');
  completion.command('remove', 'Remove a package');
  completion.command('install', 'Install dependencies');
  completion.command('upgrade', 'Update dependencies');
  completion.command('run', 'Run a script');
  completion.command('exec', 'Execute a command');
  completion.command('create', 'Create a new project');
  completion.command('init', 'Initialize a new project');
}

export function setupBunCompletions(completion: PackageManagerCompletion) {
  completion.command('add', 'Install a package');
  completion.command('remove', 'Remove a package');
  completion.command('install', 'Install dependencies');
  completion.command('update', 'Update dependencies');
  completion.command('run', 'Run a script');
  completion.command('x', 'Execute a command');
  completion.command('create', 'Create a new project');
  completion.command('init', 'Initialize a new project');
}
