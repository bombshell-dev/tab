import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeContext, makeUninstallContext } from '../src/install/context';
import { installFish, uninstallFish } from '../src/install/fish';
import { installBash, uninstallBash } from '../src/install/bash';
import {
  makeFileMarker,
  inspectFile,
  wrapBlock,
  upsertBlock,
  fileContainsBlock,
  removeBlock,
} from '../src/install/markers';

function newTmpDir() {
  return mkdtempSync(join(tmpdir(), 'tab-install-'));
}

function baseUninstallCtx(
  overrides: Partial<Parameters<typeof makeUninstallContext>[0]> = {}
) {
  return makeUninstallContext({
    name: 'test-cli',
    dryRun: false,
    force: false,
    verbose: false,
    ...overrides,
  });
}

function baseCtx(overrides: Partial<Parameters<typeof makeContext>[0]> = {}) {
  return makeContext({
    name: 'test-cli',
    executable: 'test-cli',
    version: '9.9.9',
    dryRun: false,
    force: false,
    verbose: false,
    detected: {
      pathReachable: true,
      resolvedPath: '/usr/local/bin/test-cli',
      installMethod: 'standalone',
    },
    ...overrides,
  });
}

describe('markers', () => {
  it('inspectFile returns managedByTab=true with version when marker present', () => {
    const tmp = newTmpDir();
    const file = join(tmp, 'sample');
    writeFileSync(
      file,
      `${makeFileMarker('test-cli', '1.2.3', '#')}\n# rest of file\n`
    );
    expect(inspectFile(file)).toEqual({
      managedByTab: true,
      name: 'test-cli',
      version: '1.2.3',
    });
  });

  it('inspectFile returns managedByTab=false for unmanaged files', () => {
    const tmp = newTmpDir();
    const file = join(tmp, 'sample');
    writeFileSync(file, '# someone elses completion file\n');
    expect(inspectFile(file).managedByTab).toBe(false);
  });

  it('upsertBlock inserts a new block when none exists', () => {
    const block = wrapBlock('test-cli', 'echo hello', '#');
    const result = upsertBlock('existing content\n', 'test-cli', block, '#');
    expect(result).toContain('# >>> tab:test-cli >>>');
    expect(result).toContain('echo hello');
    expect(result).toContain('# <<< tab:test-cli <<<');
    expect(result).toContain('existing content');
  });

  it('upsertBlock replaces an existing block in place (idempotent)', () => {
    const first = wrapBlock('test-cli', 'old body', '#');
    const second = wrapBlock('test-cli', 'new body', '#');
    let content = upsertBlock('# header\n', 'test-cli', first, '#');
    content = upsertBlock(content, 'test-cli', second, '#');
    expect(content).toContain('new body');
    expect(content).not.toContain('old body');
    // sentinel pair should appear exactly once
    expect(content.match(/>>> tab:test-cli >>>/g)?.length).toBe(1);
  });

  it('fileContainsBlock detects the sentinel pair', () => {
    const tmp = newTmpDir();
    const file = join(tmp, 'profile');
    writeFileSync(file, wrapBlock('test-cli', 'body', '#'));
    expect(fileContainsBlock(file, 'test-cli', '#')).toBe(true);
    expect(fileContainsBlock(file, 'other-cli', '#')).toBe(false);
  });
});

describe('installFish', () => {
  let origXdg: string | undefined;
  let tmp: string;

  beforeEach(() => {
    tmp = newTmpDir();
    origXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tmp;
  });
  afterEach(() => {
    if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = origXdg;
  });

  it('writes a marker-tagged completion file', () => {
    const result = installFish(baseCtx());
    expect(result.status).toBe('installed');
    const file = join(tmp, 'fish', 'completions', 'test-cli.fish');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf-8')).toContain(
      'tab-completion managed-by=tab name=test-cli version=9.9.9'
    );
  });

  it('returns already-installed on identical re-run', () => {
    installFish(baseCtx());
    const result = installFish(baseCtx());
    expect(result.status).toBe('already-installed');
    expect(result.actions[0].performed).toBe(false);
  });

  it('returns updated when version differs', () => {
    installFish(baseCtx({ version: '1.0.0' }));
    const result = installFish(baseCtx({ version: '2.0.0' }));
    expect(result.status).toBe('updated');
  });

  it('blocks when an unmanaged file exists', () => {
    const dir = join(tmp, 'fish', 'completions');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'test-cli.fish'), '# my own completion\n');
    const result = installFish(baseCtx());
    expect(result.status).toBe('blocked');
    expect(result.userInstructions[0]).toMatch(/Remove|force/);
  });

  it('overwrites unmanaged file with force', () => {
    const dir = join(tmp, 'fish', 'completions');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'test-cli.fish'), '# my own completion\n');
    const result = installFish(baseCtx({ force: true }));
    expect(result.status).toBe('installed');
    expect(readFileSync(join(dir, 'test-cli.fish'), 'utf-8')).toContain(
      'managed-by=tab'
    );
  });

  it('honors dryRun (no file written)', () => {
    const result = installFish(baseCtx({ dryRun: true }));
    expect(result.status).toBe('installed');
    expect(result.actions[0].performed).toBe(false);
    expect(existsSync(join(tmp, 'fish', 'completions', 'test-cli.fish'))).toBe(
      false
    );
  });
});

describe('markers.removeBlock', () => {
  it('removes a wrapped block leaving surrounding content intact', () => {
    const block = wrapBlock('test-cli', 'body', '#');
    const content = `# header line\n${block}# trailing line\n`;
    const stripped = removeBlock(content, 'test-cli', '#');
    expect(stripped).toContain('# header line');
    expect(stripped).toContain('# trailing line');
    expect(stripped).not.toContain('>>> tab:test-cli >>>');
    expect(stripped).not.toContain('body');
  });

  it('is a no-op when the block is not present', () => {
    const content = '# unrelated content\n';
    expect(removeBlock(content, 'test-cli', '#')).toBe(content);
  });
});

describe('uninstallFish', () => {
  let origXdg: string | undefined;
  let tmp: string;

  beforeEach(() => {
    tmp = newTmpDir();
    origXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tmp;
  });
  afterEach(() => {
    if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = origXdg;
  });

  it('returns not-installed when there is no completion file', () => {
    const result = uninstallFish(baseUninstallCtx());
    expect(result.status).toBe('not-installed');
    expect(result.actions).toHaveLength(0);
  });

  it('removes a managed completion file', () => {
    installFish(baseCtx());
    const file = join(tmp, 'fish', 'completions', 'test-cli.fish');
    expect(existsSync(file)).toBe(true);
    const result = uninstallFish(baseUninstallCtx());
    expect(result.status).toBe('uninstalled');
    expect(existsSync(file)).toBe(false);
  });

  it('refuses to remove an unmanaged file without force', () => {
    const dir = join(tmp, 'fish', 'completions');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'test-cli.fish');
    writeFileSync(file, '# my own file\n');
    const result = uninstallFish(baseUninstallCtx());
    expect(result.status).toBe('blocked');
    expect(existsSync(file)).toBe(true);
  });

  it('removes an unmanaged file with force', () => {
    const dir = join(tmp, 'fish', 'completions');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'test-cli.fish');
    writeFileSync(file, '# my own file\n');
    const result = uninstallFish(baseUninstallCtx({ force: true }));
    expect(result.status).toBe('uninstalled');
    expect(existsSync(file)).toBe(false);
  });

  it('honors dryRun (no file removed)', () => {
    installFish(baseCtx());
    const file = join(tmp, 'fish', 'completions', 'test-cli.fish');
    const result = uninstallFish(baseUninstallCtx({ dryRun: true }));
    expect(result.status).toBe('uninstalled');
    expect(result.actions[0].performed).toBe(false);
    expect(existsSync(file)).toBe(true);
  });
});

describe('uninstallBash', () => {
  let origXdg: string | undefined;
  let tmp: string;

  beforeEach(() => {
    tmp = newTmpDir();
    origXdg = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = tmp;
  });
  afterEach(() => {
    if (origXdg === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = origXdg;
  });

  it('removes a managed completion file', () => {
    installBash(baseCtx());
    const file = join(tmp, 'bash-completion', 'completions', 'test-cli');
    expect(existsSync(file)).toBe(true);
    const result = uninstallBash(baseUninstallCtx());
    expect(result.status).toBe('uninstalled');
    expect(existsSync(file)).toBe(false);
  });
});

describe('installBash', () => {
  let origXdg: string | undefined;
  let tmp: string;

  beforeEach(() => {
    tmp = newTmpDir();
    origXdg = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = tmp;
  });
  afterEach(() => {
    if (origXdg === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = origXdg;
  });

  it('writes a completion file in the XDG data dir', () => {
    const result = installBash(baseCtx());
    const file = join(tmp, 'bash-completion', 'completions', 'test-cli');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf-8')).toContain('managed-by=tab');
    // status depends on whether bash-completion is detected on the host; both are valid outcomes
    expect(['installed', 'needs-user-action']).toContain(result.status);
  });
});
