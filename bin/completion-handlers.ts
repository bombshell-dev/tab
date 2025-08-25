import { PackageManagerCompletion } from './package-manager-completion.js';
import { readFileSync } from 'fs';

// Helper functions for dynamic completions
function getPackageJsonScripts(): string[] {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return Object.keys(packageJson.scripts || {});
  } catch {
    return [];
  }
}

function getPackageJsonDependencies(): string[] {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    };
    return Object.keys(deps);
  } catch {
    return [];
  }
}

// Common completion handlers
const scriptCompletion = async (complete: any) => {
  const scripts = getPackageJsonScripts();
  scripts.forEach((script) => complete(script, `Run ${script} script`));
};

const dependencyCompletion = async (complete: any) => {
  const deps = getPackageJsonDependencies();
  deps.forEach((dep) => complete(dep, ''));
};

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
}

export function setupPnpmCompletions(completion: PackageManagerCompletion) {
  // Package management
  const addCmd = completion.command(
    'add',
    'Installs a package and any packages that it depends on. By default, any new package is installed as a prod dependency'
  );
  addCmd.option('save-dev', 'Save package to your `devDependencies`', 'D');
  addCmd.option(
    'save-optional',
    'Save package to your `optionalDependencies`',
    'O'
  );
  addCmd.option('save-exact', 'Install exact version', 'E');
  addCmd.option('global', 'Install as a global package', 'g');
  addCmd.option(
    'workspace',
    'Only adds the new dependency if it is found in the workspace'
  );
  addCmd.option(
    'filter',
    'Restricts the scope to package names matching the given pattern'
  );

  const removeCmd = completion.command(
    'remove',
    "Removes packages from node_modules and from the project's package.json"
  );
  removeCmd.argument('package', dependencyCompletion);
  removeCmd.option('global', 'Remove globally', 'g');

  const installCmd = completion.command(
    'install',
    'Install all dependencies for a project'
  );
  installCmd.option(
    'frozen-lockfile',
    "Don't generate a lockfile and fail if an update is needed"
  );
  installCmd.option(
    'prefer-frozen-lockfile',
    'If the available `pnpm-lock.yaml` satisfies the `package.json` then perform a headless installation'
  );
  installCmd.option(
    'production',
    "Packages in `devDependencies` won't be installed"
  );
  installCmd.option('dev', 'Only `devDependencies` are installed');
  installCmd.option('optional', '`optionalDependencies` are not installed');
  installCmd.option(
    'filter',
    'Restricts the scope to package names matching the given pattern'
  );

  const updateCmd = completion.command(
    'update',
    'Updates packages to their latest version based on the specified range'
  );
  updateCmd.argument('package', dependencyCompletion);
  updateCmd.option('latest', 'Ignore version ranges in package.json');
  updateCmd.option('global', 'Update globally installed packages', 'g');
  updateCmd.option(
    'interactive',
    'Show outdated dependencies and select which ones to update',
    'i'
  );

  // Script execution
  const runCmd = completion.command('run', 'Runs a defined package script');
  runCmd.argument('script', scriptCompletion, true);
  runCmd.option(
    'parallel',
    'Completely disregard concurrency and topological sorting, running a given script immediately in all matching packages with prefixed streaming output'
  );
  runCmd.option(
    'stream',
    'Stream output from child processes immediately, prefixed with the originating package directory'
  );
  runCmd.option(
    'filter',
    'Restricts the scope to package names matching the given pattern'
  );

  const execCmd = completion.command(
    'exec',
    'Executes a shell command in scope of a project'
  );
  execCmd.option(
    'filter',
    'Restricts the scope to package names matching the given pattern'
  );
  execCmd.option('parallel', 'Run in parallel');
  execCmd.option(
    'stream',
    'Stream output from child processes immediately, prefixed with the originating package directory'
  );

  completion.command('dlx', 'Run package without installing');

  // Project management
  completion.command('create', 'Create new project');
  completion.command('init', 'Initialize project');

  // Publishing
  const publishCmd = completion.command('publish', 'Publish package');
  publishCmd.option('tag', 'Publish with tag');
  publishCmd.option('access', 'Set access level');
  publishCmd.option('otp', 'One-time password');
  publishCmd.option('dry-run', 'Dry run');

  const packCmd = completion.command('pack', 'Create tarball');
  packCmd.option('pack-destination', 'Destination directory');

  // Linking
  const linkCmd = completion.command('link', 'Link packages');
  linkCmd.option('global', 'Link globally', 'g');

  const unlinkCmd = completion.command('unlink', 'Unlink packages');
  unlinkCmd.option('global', 'Unlink globally', 'g');

  // Information
  const listCmd = completion.command(
    'list',
    'Print all the versions of packages that are installed, as well as their dependencies, in a tree-structure'
  );
  listCmd.option(
    'depth',
    'How deep should levels of dependencies be inspected'
  );
  listCmd.option('global', 'List global packages', 'g');
  listCmd.option('long', 'Show extended information');
  listCmd.option('parseable', 'Parseable output');
  listCmd.option('json', 'JSON output');

  const outdatedCmd = completion.command(
    'outdated',
    'Check for outdated packages'
  );
  outdatedCmd.option('global', 'Check global packages', 'g');
  outdatedCmd.option('long', 'Show extended information');

  const auditCmd = completion.command(
    'audit',
    'Checks for known security issues with the installed packages'
  );
  auditCmd.option('fix', 'Automatically fix vulnerabilities');
  auditCmd.option('json', 'JSON output');

  // Workspace commands
  completion.command('workspace', 'Workspace commands');

  // Store management
  completion.command('store', 'Store management');
  completion.command(
    'store status',
    'Checks for modified packages in the store'
  );
  completion.command(
    'store prune',
    'Removes unreferenced (extraneous, orphan) packages from the store'
  );
  completion.command(
    'store path',
    'Prints the path to the active store directory'
  );

  // Configuration
  completion.command('config', 'Configuration');
  completion.command('config get', 'Get config value');
  completion.command('config set', 'Set config value');
  completion.command('config delete', 'Delete config value');
  completion.command('config list', 'List config');

  // Other useful commands
  completion.command('why', 'Explain why package is installed');
  completion.command('rebuild', 'Rebuild a package');
  completion.command('root', 'Prints the effective modules directory');
  completion.command('bin', 'Print bin directory');
  completion.command(
    'start',
    'Runs an arbitrary command specified in the package\'s "start" property of its "scripts" object'
  );
  completion.command(
    'test',
    'Runs a package\'s "test" script, if one was provided'
  );
  completion.command('restart', 'Run restart script');
  completion.command('stop', 'Run stop script');
}

export function setupNpmCompletions(completion: PackageManagerCompletion) {
  // Package management
  const installCmd = completion.command(
    'install',
    'install all the dependencies in your project'
  );
  installCmd.option('save', 'Save to dependencies', 'S');
  installCmd.option('save-dev', 'Save to devDependencies', 'D');
  installCmd.option('save-optional', 'Save to optionalDependencies', 'O');
  installCmd.option('save-exact', 'Save exact version', 'E');
  installCmd.option('global', 'Install globally', 'g');
  installCmd.option('production', 'Production install');
  installCmd.option('only', 'Install only specific dependencies');

  const uninstallCmd = completion.command('uninstall', 'Remove a package');
  uninstallCmd.argument('package', dependencyCompletion);
  uninstallCmd.option('save', 'Remove from dependencies', 'S');
  uninstallCmd.option('save-dev', 'Remove from devDependencies', 'D');
  uninstallCmd.option('global', 'Remove globally', 'g');

  const updateCmd = completion.command('update', 'Update packages');
  updateCmd.argument('package', dependencyCompletion);
  updateCmd.option('global', 'Update global packages', 'g');

  // Script execution
  const runCmd = completion.command('run', 'run the script named <foo>');
  runCmd.argument('script', scriptCompletion, true);

  const runScriptCmd = completion.command('run-script', 'Run scripts');
  runScriptCmd.argument('script', scriptCompletion, true);

  completion.command('exec', 'Execute command');

  // Project management
  const initCmd = completion.command('init', 'Initialize project');
  initCmd.option('yes', 'Use defaults', 'y');
  initCmd.option('scope', 'Set scope');

  // Publishing
  const publishCmd = completion.command('publish', 'Publish package');
  publishCmd.option('tag', 'Publish with tag');
  publishCmd.option('access', 'Set access level');
  publishCmd.option('otp', 'One-time password');
  publishCmd.option('dry-run', 'Dry run');

  completion.command('pack', 'Create tarball');

  // Linking
  completion.command('link', 'Link packages');
  completion.command('unlink', 'Unlink packages');

  // Information
  const listCmd = completion.command('list', 'List packages');
  listCmd.option('depth', 'Max depth');
  listCmd.option('global', 'List global packages', 'g');
  listCmd.option('long', 'Show extended information');
  listCmd.option('parseable', 'Parseable output');
  listCmd.option('json', 'JSON output');

  const lsCmd = completion.command('ls', 'List packages (alias)');
  lsCmd.option('depth', 'Max depth');
  lsCmd.option('global', 'List global packages', 'g');

  const outdatedCmd = completion.command('outdated', 'Check outdated packages');
  outdatedCmd.option('global', 'Check global packages', 'g');

  const auditCmd = completion.command('audit', 'Security audit');
  auditCmd.option('fix', 'Fix vulnerabilities');
  auditCmd.option('json', 'JSON output');

  // Configuration
  completion.command('config', 'Configuration');
  completion.command('config get', 'Get config value');
  completion.command('config set', 'Set config value');
  completion.command('config delete', 'Delete config value');
  completion.command('config list', 'List config');

  // Other commands
  completion.command('version', 'Bump version');
  completion.command('view', 'View package info');
  completion.command('search', 'Search packages');
  completion.command('whoami', 'Display username');
  completion.command('login', 'Login to registry');
  completion.command('logout', 'Logout from registry');
  completion.command('adduser', 'Add user');
  completion.command('owner', 'Manage package owners');
  completion.command('deprecate', 'Deprecate package');
  completion.command('dist-tag', 'Manage distribution tags');
  completion.command('cache', 'Manage cache');
  completion.command('completion', 'Tab completion');
  completion.command('explore', 'Browse package');
  completion.command('docs', 'Open documentation');
  completion.command('repo', 'Open repository');
  completion.command('bugs', 'Open bug tracker');
  completion.command('help', 'Get help');
  completion.command('root', 'Print root directory');
  completion.command('prefix', 'Print prefix');
  completion.command('bin', 'Print bin directory');
  completion.command('fund', 'Fund packages');
  completion.command('find-dupes', 'Find duplicate packages');
  completion.command('dedupe', 'Deduplicate packages');
  completion.command('prune', 'Remove extraneous packages');
  completion.command('rebuild', 'Rebuild packages');
  completion.command('start', 'Run start script');
  completion.command('stop', 'Run stop script');
  completion.command('test', "run this project's tests");
  completion.command('restart', 'Run restart script');
}

export function setupYarnCompletions(completion: PackageManagerCompletion) {
  // Package management
  const addCmd = completion.command(
    'add',
    'Installs a package and any packages that it depends on.'
  );
  addCmd.option('dev', 'save package to your `devDependencies`', 'D');
  addCmd.option('peer', 'save package to your `peerDependencies`', 'P');
  addCmd.option('optional', 'save package to your `optionalDependencies`', 'O');
  addCmd.option('exact', 'install exact version', 'E');
  addCmd.option(
    'tilde',
    'install most recent release with the same minor version',
    'T'
  );

  const removeCmd = completion.command(
    'remove',
    'Removes a package from your direct dependencies updating your package.json and yarn.lock.'
  );
  removeCmd.argument('package', dependencyCompletion);

  const installCmd = completion.command(
    'install',
    'Yarn install is used to install all dependencies for a project.'
  );
  installCmd.option(
    'frozen-lockfile',
    "don't generate a lockfile and fail if an update is needed"
  );
  installCmd.option(
    'prefer-offline',
    'use network only if dependencies are not available in local cache'
  );
  installCmd.option('production', 'Production install');
  installCmd.option('pure-lockfile', "don't generate a lockfile");
  installCmd.option(
    'focus',
    'Focus on a single workspace by installing remote copies of its sibling workspaces'
  );
  installCmd.option('har', 'save HAR output of network traffic');

  const upgradeCmd = completion.command(
    'upgrade',
    'Upgrades packages to their latest version based on the specified range.'
  );
  upgradeCmd.argument('package', dependencyCompletion);
  upgradeCmd.option(
    'latest',
    'list the latest version of packages, ignoring version ranges in package.json'
  );
  upgradeCmd.option('pattern', 'upgrade packages that match pattern');
  upgradeCmd.option('scope', 'upgrade packages under the specified scope');

  const upgradeInteractiveCmd = completion.command(
    'upgrade-interactive',
    'Interactive upgrade'
  );
  upgradeInteractiveCmd.option('latest', 'Show latest versions');

  // Script execution
  const runCmd = completion.command('run', 'Run scripts');
  runCmd.argument('script', scriptCompletion, true);

  completion.command('exec', 'Execute command');

  // Project management
  completion.command('create', 'Create new project');
  const initCmd = completion.command('init', 'Initialize project');
  initCmd.option('yes', 'Use defaults', 'y');
  initCmd.option('private', 'Create private package', 'p');

  // Publishing
  const publishCmd = completion.command('publish', 'Publish package');
  publishCmd.option('tag', 'Publish with tag');
  publishCmd.option('access', 'Set access level');
  publishCmd.option('new-version', 'Set new version');

  const packCmd = completion.command('pack', 'Create tarball');
  packCmd.option('filename', 'Output filename');

  // Linking
  completion.command('link', 'Link packages');
  completion.command('unlink', 'Unlink packages');

  // Information
  const listCmd = completion.command('list', 'List packages');
  listCmd.option('depth', 'Max depth');
  listCmd.option('pattern', 'Filter pattern');

  completion.command('info', 'Show package info');
  completion.command('outdated', 'Check outdated packages');
  const auditCmd = completion.command('audit', 'Security audit');
  auditCmd.option('level', 'Minimum severity level');

  // Workspace commands
  completion.command('workspace', 'Workspace commands');
  completion.command('workspaces', 'Workspaces commands');
  completion.command('workspaces info', 'Workspace info');
  completion.command('workspaces run', 'Run in workspaces');

  // Configuration
  completion.command('config', 'Configuration');
  completion.command('config get', 'Get config value');
  completion.command('config set', 'Set config value');
  completion.command('config delete', 'Delete config value');
  completion.command('config list', 'List config');

  // Cache management
  completion.command('cache', 'Cache management');
  completion.command('cache list', 'List cache');
  completion.command('cache dir', 'Cache directory');
  completion.command('cache clean', 'Clean cache');

  // Other commands
  completion.command('version', 'Show version');
  completion.command('versions', 'Show all versions');
  completion.command('why', 'Explain installation');
  completion.command('owner', 'Manage owners');
  completion.command('team', 'Manage teams');
  completion.command('login', 'Login to registry');
  completion.command('logout', 'Logout from registry');
  completion.command('tag', 'Manage tags');
  completion.command('global', 'Global packages');
  completion.command('bin', 'Print bin directory');
  completion.command('dir', 'Print modules directory');
  completion.command('licenses', 'List licenses');
  completion.command('generate-lock-entry', 'Generate lock entry');
  completion.command('check', 'Verify package tree');
  completion.command('import', 'Import from npm');
  completion.command('install-peerdeps', 'Install peer dependencies');
  completion.command('autoclean', 'Clean unnecessary files');
  completion.command('policies', 'Policies');
  completion.command('start', 'Run start script');
  completion.command('test', 'Run test script');
  completion.command('node', 'Run node');
}

export function setupBunCompletions(completion: PackageManagerCompletion) {
  // Package management
  const addCmd = completion.command(
    'add',
    'Add a dependency to package.json (bun a)'
  );
  addCmd.option('development', 'Add dependency to "devDependencies"', 'd');
  addCmd.option('optional', 'Add dependency to "optionalDependencies"');
  addCmd.option('exact', 'Add the exact version instead of the ^range', 'E');
  addCmd.option('global', 'Install globally', 'g');

  const removeCmd = completion.command(
    'remove',
    'Remove a dependency from package.json (bun rm)'
  );
  removeCmd.argument('package', dependencyCompletion);
  removeCmd.option('global', 'Remove globally', 'g');

  const installCmd = completion.command(
    'install',
    'Install dependencies for a package.json (bun i)'
  );
  installCmd.option('production', "Don't install devDependencies");
  installCmd.option('frozen-lockfile', 'Disallow changes to lockfile');
  installCmd.option('dry-run', "Don't install anything");
  installCmd.option(
    'force',
    'Always request the latest versions from the registry & reinstall all dependencies'
  );
  installCmd.option('silent', "Don't log anything");

  const updateCmd = completion.command(
    'update',
    'Update outdated dependencies'
  );
  updateCmd.argument('package', dependencyCompletion);
  updateCmd.option('global', 'Update global packages', 'g');

  // Script execution and running
  const runCmd = completion.command('run', 'Execute a file with Bun');
  runCmd.argument('script', scriptCompletion, true);
  runCmd.option('silent', "Don't log anything");
  runCmd.option('bun', 'Use bun runtime');

  const xCmd = completion.command(
    'x',
    'Execute a package binary (CLI), installing if needed (bunx)'
  );
  xCmd.option('bun', 'Use bun runtime');

  // Bun-specific commands
  completion.command('dev', 'Development server');
  completion.command(
    'build',
    'Bundle TypeScript & JavaScript into a single file'
  );
  completion.command('test', 'Run unit tests with Bun');

  // Project management
  completion.command('create', 'Create a new project from a template (bun c)');
  const initCmd = completion.command(
    'init',
    'Start an empty Bun project from a built-in template'
  );
  initCmd.option('yes', 'Use defaults', 'y');

  // Publishing
  const publishCmd = completion.command(
    'publish',
    'Publish a package to the npm registry'
  );
  publishCmd.option('tag', 'Publish with tag');
  publishCmd.option('access', 'Set access level');
  publishCmd.option('otp', 'One-time password');

  completion.command('pack', 'Create tarball');

  // Linking
  completion.command('link', 'Register or link a local npm package');
  completion.command('unlink', 'Unregister a local npm package');

  // Information
  const listCmd = completion.command('list', 'List packages');
  listCmd.option('global', 'List global packages', 'g');

  completion.command(
    'outdated',
    'Display latest versions of outdated dependencies'
  );
  completion.command('audit', 'Check installed packages for vulnerabilities');

  // Configuration
  completion.command('config', 'Configuration');

  // Bun runtime commands
  completion.command('bun', 'Run with Bun runtime');
  completion.command('node', 'Node.js compatibility');
  completion.command('upgrade', 'Upgrade to latest version of Bun.');
  completion.command('completions', 'Generate completions');
  completion.command('discord', 'Open Discord');
  completion.command('help', 'Show help');

  // File operations
  completion.command('install.cache', 'Cache operations');
  completion.command('pm', 'Additional package management utilities');

  // Other commands
  completion.command('start', 'Run start script');
  completion.command('stop', 'Run stop script');
  completion.command('restart', 'Run restart script');
}
