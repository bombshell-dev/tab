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
