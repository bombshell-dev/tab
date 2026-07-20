import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, delimiter } from 'node:path';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as fish from '../src/fish';

function isFishAvailable(): boolean {
  try {
    execSync('fish --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(repoRoot, 'tests', 'fixtures', 'mycli');
const tabCli = join(repoRoot, 'dist', 'bin', 'cli.mjs');

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

describe.skipIf(!isFishAvailable())('fish delegation completion', () => {
  let cacheDir: string;
  let scriptPath: string;

  beforeAll(() => {
    if (!existsSync(tabCli)) {
      execSync('pnpm build', { cwd: repoRoot, stdio: 'ignore' });
    }

    cacheDir = mkdtempSync(join(tmpdir(), 'tab-fish-integration-'));

    // Generate the pnpm completer wired to this repo's backend.
    const exec = `${process.execPath} ${tabCli} pnpm`;
    scriptPath = join(cacheDir, 'pnpm.fish');
    writeFileSync(scriptPath, fish.generate('pnpm', exec));
  });

  afterAll(() => {
    if (cacheDir) rmSync(cacheDir, { recursive: true, force: true });
  });

  // Run the generated completer for a command line and return the completion
  // values (the part before the tab-separated description).
  function complete(commandLine: string): string[] {
    const script = `source ${shQuote(scriptPath)}\ncomplete --do-complete ${shQuote(
      commandLine
    )}`;

    const result = spawnSync('fish', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixtureDir}${delimiter}${process.env.PATH ?? ''}`,
        TAB_COMPLETION_CACHE_DIR: cacheDir,
      },
    });

    return (result.stdout + result.stderr)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
  }

  it('completes a delegated CLI\u2019s subcommands (single segment)', () => {
    const completions = complete('pnpm mycli ');
    expect(completions.some((c) => c.startsWith('start'))).toBe(true);
    expect(completions.some((c) => c.startsWith('build'))).toBe(true);
    expect(completions.some((c) => c.startsWith('db'))).toBe(true);
  });

  it('includes descriptions from the delegated CLI', () => {
    const completions = complete('pnpm mycli ');
    const start = completions.find((c) => c.startsWith('start'));
    expect(start).toContain('Start the application');
  });

  it('filters delegated subcommands by partial input', () => {
    const completions = complete('pnpm mycli st');
    expect(completions.some((c) => c.startsWith('start'))).toBe(true);
    expect(completions.some((c) => c.startsWith('build'))).toBe(false);
  });

  it('completes the delegated CLI\u2019s flags', () => {
    const completions = complete('pnpm mycli --');
    expect(completions.some((c) => c.includes('--config'))).toBe(true);
    expect(completions.some((c) => c.includes('--debug'))).toBe(true);
  });

  // The following cases have a subcommand *after* the CLI name, so they are the
  // multi-segment paths that regressed. Each must reach the delegated CLI with
  // every segment intact.
  it('completes a nested subcommand (two-segment path)', () => {
    const completions = complete('pnpm mycli db ');
    expect(completions.some((c) => c.startsWith('migrate'))).toBe(true);
    expect(completions.some((c) => c.startsWith('seed'))).toBe(true);
  });

  it('completes flags after a subcommand (two-segment path)', () => {
    const completions = complete('pnpm mycli start --');
    expect(completions.some((c) => c.includes('--port'))).toBe(true);
    expect(completions.some((c) => c.includes('--config'))).toBe(true);
  });

  it('completes flags after a nested subcommand (three-segment path)', () => {
    const completions = complete('pnpm mycli db migrate --');
    expect(completions.some((c) => c.includes('--force'))).toBe(true);
    expect(completions.some((c) => c.includes('--name'))).toBe(true);
  });
});
