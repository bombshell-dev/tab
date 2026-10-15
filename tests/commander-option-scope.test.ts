import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const fixture = 'tests/fixtures/commander-option-scope.ts';

async function complete(
  args: string[],
  positionalOptions: boolean
): Promise<string[]> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [tsxCli, fixture, ...args],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        COMMANDER_POSITIONAL: positionalOptions ? '1' : '0',
      },
    }
  );

  return stdout
    .split('\n')
    .filter((line) => line && !line.startsWith(':'))
    .map((line) => line.split('\t')[0]);
}

describe('Commander option scope', () => {
  describe('default options', () => {
    it('uses the root option when a subcommand reuses its short flag', async () => {
      await expect(complete(['serve', '-c', ''], false)).resolves.toEqual([
        'top',
        'global',
      ]);
    });

    it('keeps a non-conflicting leaf long option available', async () => {
      await expect(
        complete(['serve', '--leaf-choice', ''], false)
      ).resolves.toEqual(['leaf', 'local']);
    });

    it('keeps root option values available after a subcommand', async () => {
      await expect(
        complete(['serve', '--root-choice', ''], false)
      ).resolves.toEqual(['top', 'global']);
    });

    it('suggests root option names after a subcommand', async () => {
      await expect(complete(['serve', '--root-c'], false)).resolves.toEqual([
        '--root-choice',
      ]);
    });

    it('uses root option arity for a colliding short flag', async () => {
      const values = await complete(['serve', '-b', ''], false);

      expect(values).toEqual(expect.arrayContaining(['prod', 'staging']));
      expect(values).not.toEqual(expect.arrayContaining(['blue', 'green']));
    });

    it('uses an ancestor option before a nested command option', async () => {
      await expect(
        complete(['serve', 'nested', '-a', ''], false)
      ).resolves.toEqual(['parent', 'ancestor']);
    });
  });

  describe('positional options', () => {
    it('uses the subcommand option when it reuses a root short flag', async () => {
      await expect(complete(['serve', '-c', ''], true)).resolves.toEqual([
        'leaf',
        'local',
      ]);
    });

    it('does not complete root option values after a subcommand', async () => {
      await expect(
        complete(['serve', '--root-choice', ''], true)
      ).resolves.toEqual([]);
    });

    it('does not suggest root option names after a subcommand', async () => {
      await expect(complete(['serve', '--root-c'], true)).resolves.toEqual([]);
    });

    it('still accepts root options before the subcommand', async () => {
      await expect(
        complete(['--root-choice', 'top', 'serve', '-c', ''], true)
      ).resolves.toEqual(['leaf', 'local']);
    });

    it('uses leaf option arity for a colliding short flag', async () => {
      await expect(complete(['serve', '-b', ''], true)).resolves.toEqual([
        'blue',
        'green',
      ]);
    });

    it('limits nested lookup to the matched command', async () => {
      await expect(
        complete(['serve', 'nested', '-a', ''], true)
      ).resolves.toEqual(['deep', 'nested']);
    });
  });
});
