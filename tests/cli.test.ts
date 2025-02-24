import { exec } from 'child_process';
import { describe, it, expect, test } from 'vitest';

function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

const cliTools = ['citty', 'cac'];
// const cliTools = ['citty', 'cac'];

describe.each(cliTools)('cli completion tests for %s', (cliTool) => {
  const commandPrefix = `pnpm tsx demo.${cliTool}.ts complete --`;

  it('should complete cli options', async () => {
    const output = await runCommand(`${commandPrefix}`);
    expect(output).toMatchSnapshot();
  });

  describe('cli option completion tests', () => {
    const optionTests = [
      { partial: '--p', expected: '--port' },
      { partial: '-p', expected: '-p' }, // Test short flag completion
      { partial: '-H', expected: '-H' }, // Test another short flag completion
    ];

    test.each(optionTests)(
      "should complete option for partial input '%s'",
      async ({ partial }) => {
        const command = `${commandPrefix} dev ${partial}`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );
  });

  describe('cli option exclusion tests', () => {
    const alreadySpecifiedTests = [
      { specified: '--config', shouldNotContain: '--config' },
    ];

    test.each(alreadySpecifiedTests)(
      "should not suggest already specified option '%s'",
      async ({ specified }) => {
        const command = `${commandPrefix} ${specified} --`;
        const output = await runCommand(command);
        console.log(output);
        expect(output).toMatchSnapshot();
      }
    );
  });

  describe('cli option value handling', () => {
    it('should resolve port value correctly', async () => {
      const command = `${commandPrefix} dev --port=3`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should not show duplicate options', async () => {
      const command = `${commandPrefix} --config vite.config.js --`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should resolve config option values correctly', async () => {
      const command = `${commandPrefix} --config vite.config`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should handle unknown options with no completions', async () => {
      const command = `${commandPrefix} --unknownoption`;
      const output = await runCommand(command);
      expect(output.trim()).toMatchSnapshot();
    });
  });

  describe('edge case completions for end with space', () => {
    //TOOD: remove this
    it('should suggest port values if user ends with space after `--port`', async () => {
      const command = `${commandPrefix} dev --port ""`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it("should keep suggesting the --port option if user typed partial but didn't end with space", async () => {
      const command = `${commandPrefix} dev --po`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it("should suggest port values if user typed `--port=` and hasn't typed a space or value yet", async () => {
      const command = `${commandPrefix} dev --port=`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });
  });

  describe('short flag handling', () => {
    it('should handle short flag value completion', async () => {
      const command = `${commandPrefix} dev -p `;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should handle short flag with equals sign', async () => {
      const command = `${commandPrefix} dev -p=3`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should handle global short flags', async () => {
      const command = `${commandPrefix} -c `;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should not show duplicate options when short flag is used', async () => {
      const command = `${commandPrefix} -c vite.config.js --`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });
  });

  // single positional command: `lint [file]`
  // vite ""
  // -> src/
  // -> ./

  // vite src/ ""
  // -> nothing
  // should not suggest anything

  // multiple postiionals command `lint [...files]`
  // vite ""
  // -> src/
  // -> ./

  // vite src/ ""
  // -> src/
  // -> ./

  describe('positional argument completions', () => {
    it.runIf(cliTool !== 'citty')(
      'should complete multiple positional arguments when ending with space',
      async () => {
        const command = `${commandPrefix} lint ""`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );

    it.runIf(cliTool !== 'citty')(
      'should complete multiple positional arguments when ending with part of the value',
      async () => {
        const command = `${commandPrefix} lint ind`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );

    it.runIf(cliTool !== 'citty')(
      'should complete single positional argument when ending with space',
      async () => {
        const command = `${commandPrefix} lint main.ts ""`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );
  });
});
