// TODO: i do not see any completion functionality in this file. nothing is being provided for the defined commands of these package managers. this is a blocker for release. every each of them should be handled.
import { Completion } from '../src/index.js';

const noopCompletion = async () => [];

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
  completion.addCommand('add', 'Install a package', [], noopCompletion);
  completion.addCommand('remove', 'Remove a package', [], noopCompletion);
  completion.addCommand(
    'install',
    'Install all dependencies',
    [],
    noopCompletion
  );
  completion.addCommand('update', 'Update packages', [], noopCompletion);
  completion.addCommand('exec', 'Execute a command', [], noopCompletion);
  completion.addCommand('run', 'Run a script', [], noopCompletion);
  completion.addCommand('publish', 'Publish package', [], noopCompletion);
  completion.addCommand('test', 'Run tests', [], noopCompletion);
  completion.addCommand('build', 'Build project', [], noopCompletion);
}

export function setupNpmCompletions(completion: Completion) {
  completion.addCommand('install', 'Install a package', [], noopCompletion);
  completion.addCommand('uninstall', 'Uninstall a package', [], noopCompletion);
  completion.addCommand('run', 'Run a script', [], noopCompletion);
  completion.addCommand('test', 'Run tests', [], noopCompletion);
  completion.addCommand('publish', 'Publish package', [], noopCompletion);
  completion.addCommand('update', 'Update packages', [], noopCompletion);
  completion.addCommand('start', 'Start the application', [], noopCompletion);
  completion.addCommand('build', 'Build project', [], noopCompletion);
}

export function setupYarnCompletions(completion: Completion) {
  completion.addCommand('add', 'Add a package', [], noopCompletion);
  completion.addCommand('remove', 'Remove a package', [], noopCompletion);
  completion.addCommand('run', 'Run a script', [], noopCompletion);
  completion.addCommand('test', 'Run tests', [], noopCompletion);
  completion.addCommand('publish', 'Publish package', [], noopCompletion);
  completion.addCommand('install', 'Install dependencies', [], noopCompletion);
  completion.addCommand('build', 'Build project', [], noopCompletion);
}

export function setupBunCompletions(completion: Completion) {
  completion.addCommand('add', 'Add a package', [], noopCompletion);
  completion.addCommand('remove', 'Remove a package', [], noopCompletion);
  completion.addCommand('run', 'Run a script', [], noopCompletion);
  completion.addCommand('test', 'Run tests', [], noopCompletion);
  completion.addCommand('install', 'Install dependencies', [], noopCompletion);
  completion.addCommand('update', 'Update packages', [], noopCompletion);
  completion.addCommand('build', 'Build project', [], noopCompletion);
}
