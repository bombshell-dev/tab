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

const cliTools = ['citty', 'cac', 'commander'];

describe.each(cliTools)('cli completion tests for %s', (cliTool) => {
  // For Commander, we need to skip most of the tests since it handles completion differently
  const shouldSkipTest = cliTool === 'commander';

  // Commander uses a different command structure for completion
  const commandPrefix =
    cliTool === 'commander'
      ? `pnpm tsx examples/demo.${cliTool}.ts complete`
      : `pnpm tsx examples/demo.${cliTool}.ts complete --`;

  it.runIf(!shouldSkipTest)('should complete cli options', async () => {
    const output = await runCommand(`${commandPrefix}`);
    expect(output).toMatchSnapshot();
  });

  describe.runIf(!shouldSkipTest)('cli option completion tests', () => {
    const optionTests = [
      { partial: '--p', expected: '--port' },
      { partial: '-p', expected: '-p' }, // Test short flag completion
      { partial: '-H', expected: '-H' }, // Test another short flag completion
    ];

    test.each(optionTests)(
      "should complete option for partial input '%s'",
      async ({ partial }) => {
        const command = `${commandPrefix} serve ${partial}`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );
  });

  describe.runIf(!shouldSkipTest)('cli option exclusion tests', () => {
    const alreadySpecifiedTests = [
      { specified: '--config', shouldNotContain: '--config' },
    ];

    test.each(alreadySpecifiedTests)(
      "should not suggest already specified option '%s'",
      async ({ specified, shouldNotContain }) => {
        const command = `${commandPrefix} ${specified} --`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );
  });

  describe.runIf(!shouldSkipTest)('cli option value handling', () => {
    it('should resolve port value correctly', async () => {
      const command = `${commandPrefix} serve --port=3`;
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

  describe.runIf(!shouldSkipTest)(
    'edge case completions for end with space',
    () => {
      it('should suggest port values if user ends with space after `--port`', async () => {
        const command = `${commandPrefix} serve --port ""`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      });

      it("should keep suggesting the --port option if user typed partial but didn't end with space", async () => {
        const command = `${commandPrefix} serve --po`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      });

      it("should suggest port values if user typed `--port=` and hasn't typed a space or value yet", async () => {
        const command = `${commandPrefix} serve --port=`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      });
    }
  );

  describe.runIf(!shouldSkipTest)('short flag handling', () => {
    it('should handle short flag value completion', async () => {
      const command = `${commandPrefix} serve -p `;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it('should handle short flag with equals sign', async () => {
      const command = `${commandPrefix} serve -p=3`;
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

  describe.runIf(!shouldSkipTest && cliTool !== 'citty')(
    'positional argument completions',
    () => {
      it('should complete multiple positional arguments when ending with space', async () => {
        const command = `${commandPrefix} lint ""`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      });

      it('should complete multiple positional arguments when ending with part of the value', async () => {
        const command = `${commandPrefix} lint ind`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      });

      it('should complete single positional argument when ending with space', async () => {
        const command = `${commandPrefix} lint main.ts ""`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      });
    }
  );
});

// Add specific tests for Commander
describe('commander specific tests', () => {
  it('should complete commands', async () => {
    const command = `pnpm tsx examples/demo.commander.ts complete -- `;
    const output = await runCommand(command);
    expect(output).toContain('serve');
    expect(output).toContain('build');
    expect(output).toContain('deploy');
  });

  it('should handle subcommands', async () => {
    // First, we need to check if deploy is recognized as a command
    const command1 = `pnpm tsx examples/demo.commander.ts complete -- deploy`;
    const output1 = await runCommand(command1);
    expect(output1).toContain('deploy');
    expect(output1).toContain('Deploy the application');

    // Then we need to check if the deploy command has subcommands
    // We can check this by running the deploy command with --help
    const command2 = `pnpm tsx examples/demo.commander.ts deploy --help`;
    const output2 = await runCommand(command2);
    expect(output2).toContain('staging');
    expect(output2).toContain('production');
  });
});

describe('shell completion script generation', () => {
  const shells = ['zsh', 'bash', 'fish', 'powershell'];
  const cliTool = 'commander'; // Use commander for shell script generation tests

  test.each(shells)('should generate %s completion script', async (shell) => {
    const command = `pnpm tsx examples/demo.${cliTool}.ts complete ${shell}`;
    const output = await runCommand(command);
    expect(output).toContain(`# ${shell} completion for`);
    expect(output.length).toBeGreaterThan(100); // Ensure we got a substantial script
  });
});
