export type SupportedShell = 'zsh' | 'bash' | 'fish' | 'powershell';

export type InstallMethod =
  | 'npm-global'
  | 'brew'
  | 'standalone'
  | 'node-modules'
  | 'unknown';

export type InstallStatus =
  | 'installed'
  | 'already-installed'
  | 'updated'
  | 'needs-user-action'
  | 'blocked'
  | 'failed';

export type InstallAction = {
  type: 'write-file' | 'append-file' | 'create-dir';
  path: string;
  performed: boolean;
};

export type ShellEnvProbe = Record<string, unknown>;

export type InstallResult = {
  shell: SupportedShell;
  status: InstallStatus;
  detected: {
    pathReachable: boolean;
    resolvedPath?: string;
    installMethod: InstallMethod;
    shellEnv: ShellEnvProbe;
  };
  actions: InstallAction[];
  userInstructions: string[];
  warnings: string[];
  explanation?: string;
};

export type UninstallStatus =
  | 'uninstalled'
  | 'not-installed'
  | 'blocked'
  | 'failed';

export type UninstallAction = {
  type: 'remove-file' | 'remove-block';
  path: string;
  performed: boolean;
};

export type UninstallResult = {
  shell: SupportedShell;
  status: UninstallStatus;
  actions: UninstallAction[];
  warnings: string[];
  explanation?: string;
};

export type UninstallOptions = {
  /** The command name. Auto-detected from argv/package.json if omitted. */
  name?: string;
  /** Which shell to uninstall from. 'auto' detects the current shell. */
  shell?: SupportedShell | 'auto';
  /** Compute the plan without touching disk. */
  dryRun?: boolean;
  /** Remove completion files even if they don't have our marker. */
  force?: boolean;
  /** Print a human-readable summary to stderr. */
  print?: boolean | 'on-error';
  /** Emit detection-step logs to stderr. */
  verbose?: boolean;
};

export type InstallOptions = {
  /** The command name (e.g. 'my-cli'). Auto-detected from argv/package.json if omitted. */
  name?: string;
  /** How to invoke the CLI from a completion script (e.g. 'my-cli'). Defaults to `name`. */
  executable?: string;
  /** Which shell to install for. 'auto' detects the current shell. */
  shell?: SupportedShell | 'auto';
  /** Compute the install plan without touching disk. */
  dryRun?: boolean;
  /** Overwrite existing completion files that we did not manage. */
  force?: boolean;
  /**
   * Print a human-readable summary to stderr.
   * - `true`: always print
   * - `false`: never print
   * - `'on-error'` (default): print only when the result needs user attention
   */
  print?: boolean | 'on-error';
  /** Emit detection-step logs to stderr for debugging. */
  verbose?: boolean;
};
