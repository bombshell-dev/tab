import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, accessSync, constants } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import type { InstallMethod, SupportedShell } from './types';

const IS_WINDOWS = platform() === 'win32';

function safeExec(cmd: string, args: string[]): string | undefined {
  try {
    return execFileSync(cmd, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
      timeout: 2000,
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Detect the active shell. Tries, in order:
 *  1. Windows: PSModulePath → powershell
 *  2. parent process inspection (ppid → comm)
 *  3. $SHELL env var (this is the *login* shell, not necessarily the running one)
 */
export function detectShell(): SupportedShell | undefined {
  if (IS_WINDOWS && process.env.PSModulePath) {
    return 'powershell';
  }

  const parent = detectParentShell();
  if (parent) return parent;

  const shellEnv = process.env.SHELL;
  if (shellEnv) {
    const name = basename(shellEnv).toLowerCase();
    if (name.includes('zsh')) return 'zsh';
    if (name.includes('bash')) return 'bash';
    if (name.includes('fish')) return 'fish';
    if (name === 'pwsh' || name === 'powershell') return 'powershell';
  }

  return undefined;
}

function detectParentShell(): SupportedShell | undefined {
  const ppid = process.ppid;
  if (!ppid) return undefined;

  let comm: string | undefined;
  if (platform() === 'linux') {
    try {
      comm = readFileSync(`/proc/${ppid}/comm`, 'utf-8').trim();
    } catch {
      // ignore
    }
  } else {
    comm = safeExec('ps', ['-p', String(ppid), '-o', 'comm=']);
    if (comm) comm = basename(comm);
  }

  if (!comm) return undefined;
  const name = comm.toLowerCase();
  if (name.includes('zsh')) return 'zsh';
  if (name.includes('bash')) return 'bash';
  if (name.includes('fish')) return 'fish';
  if (name === 'pwsh' || name === 'powershell') return 'powershell';
  return undefined;
}

/**
 * Try to determine the CLI's command name from `process.argv[1]` or the nearest
 * package.json. Callers may always override with `options.name`.
 */
export function detectName(): string | undefined {
  const argv1 = process.argv[1];
  if (argv1) {
    const base = basename(argv1).replace(/\.(c?js|mjs|ts)$/, '');
    if (base && base !== 'index') return base;
  }

  let dir = argv1 ? dirname(argv1) : process.cwd();
  for (let i = 0; i < 8; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (typeof pkg.bin === 'string') return pkg.name;
        if (pkg.bin && typeof pkg.bin === 'object') {
          const names = Object.keys(pkg.bin);
          if (names.length > 0) return names[0];
        }
        if (typeof pkg.name === 'string') {
          const scoped = pkg.name.split('/').pop();
          if (scoped) return scoped;
        }
      } catch {
        // ignore
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Build a PATH list with npm's project-local prepends removed, so we can ask
 * "is this binary reachable from a fresh shell?" When npm/pnpm/yarn runs a
 * lifecycle script or `exec` command, they prepend `<cwd>/node_modules/.bin`
 * (and ancestors) onto PATH. Those entries make `which mycli` succeed even
 * though the binary won't be reachable from a regular shell.
 */
function stripNodeModulesFromPath(pathStr: string, cwd: string): string {
  const delim = IS_WINDOWS ? ';' : ':';
  const parts = pathStr.split(delim);
  let cur = cwd;
  const ancestorBins = new Set<string>();
  for (let i = 0; i < 32; i++) {
    ancestorBins.add(join(cur, 'node_modules', '.bin'));
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return parts
    .filter((p) => {
      const norm = resolve(p);
      if (ancestorBins.has(norm)) return false;
      // also drop any path component containing /node_modules/.bin
      if (norm.includes(`${sep}node_modules${sep}.bin`)) return false;
      return true;
    })
    .join(delim);
}

export type PathProbe = {
  reachable: boolean;
  resolvedPath?: string;
  installMethod: InstallMethod;
};

/**
 * Look up `name` on PATH with `node_modules/.bin` segments removed. If found,
 * also classify the install method (brew / npm-global / standalone).
 */
export function probePath(name: string): PathProbe {
  const cwd = process.cwd();
  const cleanedPath = stripNodeModulesFromPath(process.env.PATH || '', cwd);

  const delim = IS_WINDOWS ? ';' : ':';
  const exts = IS_WINDOWS
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';')
    : [''];

  const candidates: string[] = [];
  for (const dir of cleanedPath.split(delim)) {
    if (!dir) continue;
    for (const ext of exts) {
      candidates.push(join(dir, name + ext));
    }
  }

  let resolved: string | undefined;
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      resolved = candidate;
      break;
    } catch {
      // not executable / missing
    }
  }

  if (!resolved) {
    return { reachable: false, installMethod: 'unknown' };
  }

  return {
    reachable: true,
    resolvedPath: resolved,
    installMethod: classifyInstallMethod(resolved),
  };
}

function classifyInstallMethod(resolvedPath: string): InstallMethod {
  const norm = resolvedPath.replace(/\\/g, '/');
  if (norm.includes('/node_modules/')) return 'node-modules';

  // Homebrew: /usr/local/Cellar, /opt/homebrew, /home/linuxbrew/...
  if (
    norm.includes('/Cellar/') ||
    norm.startsWith('/opt/homebrew/') ||
    norm.startsWith('/home/linuxbrew/')
  ) {
    return 'brew';
  }

  // npm global: try to ask npm
  const npmPrefix = safeExec('npm', ['prefix', '-g']);
  if (npmPrefix && norm.startsWith(npmPrefix.replace(/\\/g, '/'))) {
    return 'npm-global';
  }

  return 'standalone';
}

/** Get $(brew --prefix) if available, with caching. */
let brewPrefixCache: string | null | undefined;
export function brewPrefix(): string | undefined {
  if (brewPrefixCache !== undefined) return brewPrefixCache ?? undefined;
  const out = safeExec('brew', ['--prefix']);
  brewPrefixCache = out || null;
  return out;
}

/**
 * Run `zsh -ic 'print -l -- $fpath'` to enumerate the user's actual fpath.
 * Filters out entries that don't exist.
 */
export function detectZshFpath(): string[] {
  const out = safeExec('zsh', ['-ic', 'print -l -- $fpath']);
  if (!out) return [];
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && existsSync(l));
}

/** Returns true if `~/.zshrc` references `compinit`. */
export function zshrcHasCompinit(): boolean {
  const rc = join(homedir(), '.zshrc');
  if (!existsSync(rc)) return false;
  try {
    const content = readFileSync(rc, 'utf-8');
    return /^[^#\n]*\bcompinit\b/m.test(content);
  } catch {
    return false;
  }
}

/**
 * Detect whether bash-completion is installed and sourced. We probe in this order:
 *  1. Spawn `bash -ic 'echo "${BASH_COMPLETION_VERSINFO[@]}"'` — only set if sourced.
 *  2. Look for the loader file at known system/Homebrew paths.
 */
export function detectBashCompletion(): { present: boolean; loaderPath?: string } {
  const versinfo = safeExec('bash', [
    '-ic',
    'echo "${BASH_COMPLETION_VERSINFO[@]}"',
  ]);
  if (versinfo && versinfo.length > 0) {
    return { present: true };
  }

  const candidates = [
    '/usr/share/bash-completion/bash_completion',
    '/etc/bash_completion',
    '/etc/profile.d/bash_completion.sh',
  ];
  const prefix = brewPrefix();
  if (prefix) {
    candidates.push(`${prefix}/etc/profile.d/bash_completion.sh`);
    candidates.push(`${prefix}/share/bash-completion/bash_completion`);
  }

  for (const c of candidates) {
    if (existsSync(c)) return { present: true, loaderPath: c };
  }
  return { present: false };
}

/** Run `pwsh` to read `$PROFILE.CurrentUserAllHosts` (works on macOS/Linux/Windows). */
export function powershellProfilePath(): string | undefined {
  const candidates = ['pwsh', 'powershell'];
  for (const exe of candidates) {
    const out = safeExec(exe, [
      '-NoProfile',
      '-Command',
      'Write-Output $PROFILE.CurrentUserAllHosts',
    ]);
    if (out) return out;
  }
  return undefined;
}

/** Reads the current-user execution policy. Restricted blocks profile loading. */
export function powershellExecutionPolicy(): string | undefined {
  const candidates = ['pwsh', 'powershell'];
  for (const exe of candidates) {
    const out = safeExec(exe, [
      '-NoProfile',
      '-Command',
      'Get-ExecutionPolicy -Scope CurrentUser',
    ]);
    if (out) return out;
  }
  return undefined;
}
