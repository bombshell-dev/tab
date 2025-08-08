// TODO: i do not see any completion functionality in this file. nothing is being provided for the defined commands of these package managers. this is a blocker for release. every each of them should be handled.
import { Completion } from '../src/index.js';

export function setupCompletionForPackageManager(
  packageManager: string,
  completion: Completion
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

  // TODO: the core functionality of tab should have nothing related to package managers. even though completion is not there anymore, but this is something to consider.
  completion.setPackageManager(packageManager);
}

export function setupPnpmCompletions(completion: Completion) {
  completion.addCommand('add', 'Install a package', [], async () => []);
  completion.addCommand('remove', 'Remove a package', [], async () => []);
  completion.addCommand(
    'install',
    'Install all dependencies',
    [],
    async () => []
  );
  // TODO: empty functions should be replaced with noop functions rather than creating that many empty functions
  completion.addCommand('update', 'Update packages', [], async () => []);
  completion.addCommand('exec', 'Execute a command', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('publish', 'Publish package', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}

export function setupNpmCompletions(completion: Completion) {
  completion.addCommand('install', 'Install a package', [], async () => []);
  completion.addCommand('uninstall', 'Uninstall a package', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('publish', 'Publish package', [], async () => []);
  completion.addCommand('update', 'Update packages', [], async () => []);
  completion.addCommand('start', 'Start the application', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}

export function setupYarnCompletions(completion: Completion) {
  completion.addCommand('add', 'Add a package', [], async () => []);
  completion.addCommand('remove', 'Remove a package', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('publish', 'Publish package', [], async () => []);
  completion.addCommand('install', 'Install dependencies', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}

export function setupBunCompletions(completion: Completion) {
  completion.addCommand('add', 'Add a package', [], async () => []);
  completion.addCommand('remove', 'Remove a package', [], async () => []);
  completion.addCommand('run', 'Run a script', [], async () => []);
  completion.addCommand('test', 'Run tests', [], async () => []);
  completion.addCommand('install', 'Install dependencies', [], async () => []);
  completion.addCommand('update', 'Update packages', [], async () => []);
  completion.addCommand('build', 'Build project', [], async () => []);
}
