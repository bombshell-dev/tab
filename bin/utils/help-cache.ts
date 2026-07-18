import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';

// Parsing `<pm> --help` to discover a package manager's command tree is the
// single most expensive thing on the completion hot path (~0.4s). The command
// list only changes when the package manager itself is upgraded, so we cache
// the parsed result on disk.
//
// Cache validity is guarded two ways:
//   - a short TTL, and
//   - a cheap "fingerprint" of the resolved `<pm>` executable (its mtime),
//     which acts as a version proxy without paying for a `<pm> --version`
//     spawn. If the binary changes, the fingerprint changes and we re-parse.

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CacheEntry {
  timestamp: number;
  fingerprint: string;
  commands: Record<string, string>;
}

function cacheDir(): string {
  return (
    process.env.TAB_COMPLETION_CACHE_DIR ||
    join(tmpdir(), 'tab-completion-cache')
  );
}

function cacheFile(packageManager: string): string {
  return join(cacheDir(), `${packageManager}.json`);
}

function ttl(): number {
  const override = Number(process.env.TAB_COMPLETION_CACHE_TTL_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_TTL_MS;
}

function cachingDisabled(): boolean {
  return process.env.TAB_DISABLE_COMPLETION_CACHE === '1';
}

// Resolve an executable on PATH without spawning anything, so we can use its
// mtime as a version fingerprint. Best-effort: returns '' when not resolvable.
function fingerprint(packageManager: string): string {
  const pathValue = process.env.PATH || '';
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
      : [''];

  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, packageManager + ext);
      try {
        const stat = statSync(candidate);
        if (stat.isFile()) return String(stat.mtimeMs);
      } catch {
        // keep scanning
      }
    }
  }
  return '';
}

export function readCommandCache(
  packageManager: string
): Record<string, string> | null {
  if (cachingDisabled()) return null;
  try {
    const raw = readFileSync(cacheFile(packageManager), 'utf8');
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.timestamp > ttl()) return null;
    if (entry.fingerprint !== fingerprint(packageManager)) return null;
    return entry.commands;
  } catch {
    return null;
  }
}

export function writeCommandCache(
  packageManager: string,
  commands: Record<string, string>
): void {
  if (cachingDisabled()) return;
  try {
    mkdirSync(cacheDir(), { recursive: true });
    const entry: CacheEntry = {
      timestamp: Date.now(),
      fingerprint: fingerprint(packageManager),
      commands,
    };
    writeFileSync(cacheFile(packageManager), JSON.stringify(entry));
  } catch {
    // caching is best-effort; ignore write failures
  }
}

// Return the cached command map, or produce + cache it on a miss. Empty results
// are never cached, so a transient failure to read `<pm> --help` won't be
// remembered.
export async function getCachedCommandMap(
  packageManager: string,
  produce: () => Promise<Record<string, string>>
): Promise<Record<string, string>> {
  const cached = readCommandCache(packageManager);
  if (cached) return cached;

  const commands = await produce();
  if (Object.keys(commands).length > 0) {
    writeCommandCache(packageManager, commands);
  }
  return commands;
}
