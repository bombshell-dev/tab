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
  const addCmd = completion.command('add', 'Install packages');
  addCmd.option('save-dev', 'Save to devDependencies', 'D');
  addCmd.option('save-optional', 'Save to optionalDependencies', 'O');
  addCmd.option('save-exact', 'Save exact version', 'E');
  addCmd.option('global', 'Install globally', 'g');
  addCmd.option('workspace', 'Install to workspace');
  addCmd.option('filter', 'Filter packages');

  const removeCmd = completion.command('remove', 'Remove packages');
  removeCmd.argument('package', dependencyCompletion);
  removeCmd.option('global', 'Remove globally', 'g');

  const installCmd = completion.command('install', 'Install dependencies');
  installCmd.option('frozen-lockfile', 'Install with frozen lockfile');
  installCmd.option('prefer-frozen-lockfile', 'Prefer frozen lockfile');
  installCmd.option('production', 'Install production dependencies only');
  installCmd.option('dev', 'Install dev dependencies only');
  installCmd.option('optional', 'Include optional dependencies');
  installCmd.option('filter', 'Filter packages');

  const updateCmd = completion.command('update', 'Update dependencies');
  updateCmd.argument('package', dependencyCompletion);
  updateCmd.option('latest', 'Update to latest versions');
  updateCmd.option('global', 'Update global packages', 'g');
  updateCmd.option('interactive', 'Interactive update', 'i');

  // Script execution
  const runCmd = completion.command('run', 'Run scripts');
  runCmd.argument('script', scriptCompletion, true);
  runCmd.option('parallel', 'Run scripts in parallel');
  runCmd.option('stream', 'Stream output');
  runCmd.option('filter', 'Filter packages');

  const execCmd = completion.command('exec', 'Execute commands');
  execCmd.option('filter', 'Filter packages');
  execCmd.option('parallel', 'Run in parallel');
  execCmd.option('stream', 'Stream output');

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
  const listCmd = completion.command('list', 'List packages');
  listCmd.option('depth', 'Max depth');
  listCmd.option('global', 'List global packages', 'g');
  listCmd.option('long', 'Show extended information');
  listCmd.option('parseable', 'Parseable output');
  listCmd.option('json', 'JSON output');

  const outdatedCmd = completion.command('outdated', 'Check outdated packages');
  outdatedCmd.option('global', 'Check global packages', 'g');
  outdatedCmd.option('long', 'Show extended information');

  const auditCmd = completion.command('audit', 'Security audit');
  auditCmd.option('fix', 'Automatically fix vulnerabilities');
  auditCmd.option('json', 'JSON output');

  // Workspace commands
  completion.command('workspace', 'Workspace commands');

  // Store management
  completion.command('store', 'Store management');
  completion.command('store status', 'Store status');
  completion.command('store prune', 'Prune store');
  completion.command('store path', 'Store path');

  // Configuration
  completion.command('config', 'Configuration');
  completion.command('config get', 'Get config value');
  completion.command('config set', 'Set config value');
  completion.command('config delete', 'Delete config value');
  completion.command('config list', 'List config');

  // Other useful commands
  completion.command('why', 'Explain why package is installed');
  completion.command('rebuild', 'Rebuild packages');
  completion.command('root', 'Print root directory');
  completion.command('bin', 'Print bin directory');
  completion.command('start', 'Run start script');
  completion.command('test', 'Run test script');
  completion.command('restart', 'Run restart script');
  completion.command('stop', 'Run stop script');
}

export function setupNpmCompletions(completion: PackageManagerCompletion) {
  // Package management
  const installCmd = completion.command('install', 'Install packages');
  installCmd.option('save', 'Save to dependencies', 'S');
  installCmd.option('save-dev', 'Save to devDependencies', 'D');
  installCmd.option('save-optional', 'Save to optionalDependencies', 'O');
  installCmd.option('save-exact', 'Save exact version', 'E');
  installCmd.option('global', 'Install globally', 'g');
  installCmd.option('production', 'Production install');
  installCmd.option('only', 'Install only specific dependencies');

  const uninstallCmd = completion.command('uninstall', 'Remove packages');
  uninstallCmd.argument('package', dependencyCompletion);
  uninstallCmd.option('save', 'Remove from dependencies', 'S');
  uninstallCmd.option('save-dev', 'Remove from devDependencies', 'D');
  uninstallCmd.option('global', 'Remove globally', 'g');

  const updateCmd = completion.command('update', 'Update packages');
  updateCmd.argument('package', dependencyCompletion);
  updateCmd.option('global', 'Update global packages', 'g');

  // Script execution
  const runCmd = completion.command('run', 'Run scripts');
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
  completion.command('test', 'Run test script');
  completion.command('restart', 'Run restart script');
}

export function setupYarnCompletions(completion: PackageManagerCompletion) {
  // Package management
  const addCmd = completion.command('add', 'Add packages');
  addCmd.option('dev', 'Add to devDependencies', 'D');
  addCmd.option('peer', 'Add to peerDependencies', 'P');
  addCmd.option('optional', 'Add to optionalDependencies', 'O');
  addCmd.option('exact', 'Add exact version', 'E');
  addCmd.option('tilde', 'Add with tilde range', 'T');

  const removeCmd = completion.command('remove', 'Remove packages');
  removeCmd.argument('package', dependencyCompletion);

  const installCmd = completion.command('install', 'Install dependencies');
  installCmd.option('frozen-lockfile', 'Install with frozen lockfile');
  installCmd.option('prefer-offline', 'Prefer offline');
  installCmd.option('production', 'Production install');
  installCmd.option('pure-lockfile', 'Pure lockfile');
  installCmd.option('focus', 'Focus install');
  installCmd.option('har', 'Save HAR file');

  const upgradeCmd = completion.command('upgrade', 'Upgrade packages');
  upgradeCmd.argument('package', dependencyCompletion);
  upgradeCmd.option('latest', 'Upgrade to latest');
  upgradeCmd.option('pattern', 'Upgrade pattern');
  upgradeCmd.option('scope', 'Upgrade scope');

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
  const addCmd = completion.command('add', 'Add packages');
  addCmd.option('development', 'Add to devDependencies', 'd');
  addCmd.option('optional', 'Add to optionalDependencies');
  addCmd.option('exact', 'Add exact version', 'E');
  addCmd.option('global', 'Install globally', 'g');

  const removeCmd = completion.command('remove', 'Remove packages');
  removeCmd.argument('package', dependencyCompletion);
  removeCmd.option('global', 'Remove globally', 'g');

  const installCmd = completion.command('install', 'Install dependencies');
  installCmd.option('production', 'Production install');
  installCmd.option('frozen-lockfile', 'Use frozen lockfile');
  installCmd.option('dry-run', 'Dry run');
  installCmd.option('force', 'Force install');
  installCmd.option('silent', 'Silent install');

  const updateCmd = completion.command('update', 'Update packages');
  updateCmd.argument('package', dependencyCompletion);
  updateCmd.option('global', 'Update global packages', 'g');

  // Script execution and running
  const runCmd = completion.command('run', 'Run scripts');
  runCmd.argument('script', scriptCompletion, true);
  runCmd.option('silent', 'Silent output');
  runCmd.option('bun', 'Use bun runtime');

  const xCmd = completion.command('x', 'Execute packages');
  xCmd.option('bun', 'Use bun runtime');

  // Bun-specific commands
  completion.command('dev', 'Development server');
  completion.command('build', 'Build project');
  completion.command('test', 'Run tests');

  // Project management
  completion.command('create', 'Create new project');
  const initCmd = completion.command('init', 'Initialize project');
  initCmd.option('yes', 'Use defaults', 'y');

  // Publishing
  const publishCmd = completion.command('publish', 'Publish package');
  publishCmd.option('tag', 'Publish with tag');
  publishCmd.option('access', 'Set access level');
  publishCmd.option('otp', 'One-time password');

  completion.command('pack', 'Create tarball');

  // Linking
  completion.command('link', 'Link packages');
  completion.command('unlink', 'Unlink packages');

  // Information
  const listCmd = completion.command('list', 'List packages');
  listCmd.option('global', 'List global packages', 'g');

  completion.command('outdated', 'Check outdated packages');
  completion.command('audit', 'Security audit');

  // Configuration
  completion.command('config', 'Configuration');

  // Bun runtime commands
  completion.command('bun', 'Run with Bun runtime');
  completion.command('node', 'Node.js compatibility');
  completion.command('upgrade', 'Upgrade Bun');
  completion.command('completions', 'Generate completions');
  completion.command('discord', 'Open Discord');
  completion.command('help', 'Show help');

  // File operations
  completion.command('install.cache', 'Cache operations');
  completion.command('pm', 'Package manager operations');

  // Other commands
  completion.command('start', 'Run start script');
  completion.command('stop', 'Run stop script');
  completion.command('restart', 'Run restart script');
}
