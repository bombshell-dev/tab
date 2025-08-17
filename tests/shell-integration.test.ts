import { describe, it, expect } from 'vitest';
import { promisify } from 'node:util';
import { exec as execCb } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execCb);

describe('shell integration tests', () => {
  const shells = ['zsh', 'bash', 'fish', 'powershell'];
  const cliTool = 'cac';

  describe('shell script generation', () => {
    shells.forEach((shell) => {
      it(`should generate ${shell} completion script without errors`, async () => {
        const command = `pnpm tsx examples/demo.${cliTool}.ts complete ${shell}`;

        try {
          const { stdout, stderr } = await exec(command);

          // Should have output
          expect(stdout).toBeTruthy();
          expect(stdout.length).toBeGreaterThan(100);

          // Should contain shell-specific markers
          expect(stdout).toContain(`# ${shell} completion for`);

          // Should not have errors
          expect(stderr).toBe('');
        } catch (error) {
          throw new Error(`Failed to generate ${shell} script: ${error}`);
        }
      });
    });
  });

  describe('completion functionality', () => {
    const completionTests = [
      { name: 'command completion', args: 'serve' },
      { name: 'option completion', args: 'serve --p' },
      { name: 'no match', args: 'nonexistent' },
    ];

    completionTests.forEach(({ name, args }) => {
      it(`should handle ${name}`, async () => {
        const command = `pnpm tsx examples/demo.${cliTool}.ts complete -- ${args}`;

        try {
          const { stdout, stderr } = await exec(command);

          // Should have some output (completions or directive)
          expect(stdout).toBeTruthy();

          // Should end with completion directive (e.g., :0, :1, etc.)
          expect(stdout.trim()).toMatch(/:\d+$/);

          // Should not have errors
          expect(stderr).toBe('');
        } catch (error) {
          throw new Error(`Failed completion test '${name}': ${error}`);
        }
      });
    });
  });

  describe('shell script syntax validation', () => {
    it('should generate syntactically valid bash script', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete bash`;
      const { stdout } = await exec(command);

      // Write script to temp file
      const scriptPath = join(process.cwd(), 'temp-bash-completion.sh');
      await writeFile(scriptPath, stdout);

      try {
        // Test bash syntax with -n flag (syntax check only)
        await exec(`bash -n ${scriptPath}`);
        // If we get here, syntax is valid
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Bash script has syntax errors: ${error}`);
      } finally {
        // Clean up
        await unlink(scriptPath).catch(() => {});
      }
    });

    it('should generate syntactically valid zsh script', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete zsh`;
      const { stdout } = await exec(command);

      // Write script to temp file
      const scriptPath = join(process.cwd(), 'temp-zsh-completion.zsh');
      await writeFile(scriptPath, stdout);

      try {
        // Test zsh syntax with -n flag (syntax check only)
        await exec(`zsh -n ${scriptPath}`);
        // If we get here, syntax is valid
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Zsh script has syntax errors: ${error}`);
      } finally {
        // Clean up
        await unlink(scriptPath).catch(() => {});
      }
    });

    it('should generate syntactically valid fish script', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete fish`;
      const { stdout } = await exec(command);

      // Write script to temp file
      const scriptPath = join(process.cwd(), 'temp-fish-completion.fish');
      await writeFile(scriptPath, stdout);

      try {
        // Test fish syntax with -n flag (syntax check only)
        await exec(`fish -n ${scriptPath}`);
        // If we get here, syntax is valid
        expect(true).toBe(true);
      } catch (error) {
        // Fish might not be available, so make this a softer check
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('command not found') ||
          errorMessage.includes('not recognized')
        ) {
          console.warn(
            'Fish shell not available for syntax testing, skipping...'
          );
          expect(true).toBe(true);
        } else {
          throw new Error(`Fish script has syntax errors: ${errorMessage}`);
        }
      } finally {
        // Clean up
        await unlink(scriptPath).catch(() => {});
      }
    });

    it('should generate syntactically valid powershell script', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete powershell`;
      const { stdout } = await exec(command);

      // Write script to temp file
      const scriptPath = join(process.cwd(), 'temp-powershell-completion.ps1');
      await writeFile(scriptPath, stdout);

      try {
        // Test PowerShell syntax
        await exec(
          `pwsh -NoProfile -Command "& { . '${scriptPath}'; exit 0 }"`
        );
        // If we get here, syntax is valid
        expect(true).toBe(true);
      } catch (error) {
        // PowerShell might not be available, so make this a softer check
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('command not found') ||
          errorMessage.includes('not recognized')
        ) {
          console.warn(
            'PowerShell not available for syntax testing, skipping...'
          );
          expect(true).toBe(true);
        } else {
          throw new Error(
            `PowerShell script has syntax errors: ${errorMessage}`
          );
        }
      } finally {
        // Clean up
        await unlink(scriptPath).catch(() => {});
      }
    });
  });

  // Test shell-specific features
  describe('shell-specific functionality', () => {
    it('bash completion should include proper function definitions', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete bash`;
      const { stdout } = await exec(command);

      // Should contain bash completion function
      expect(stdout).toMatch(/__\w+_complete\(\)/);

      // Should contain complete command registration
      expect(stdout).toMatch(/complete -F __\w+_complete/);

      // Should handle bash completion variables (using _get_comp_words_by_ref)
      expect(stdout).toContain('_get_comp_words_by_ref');
      expect(stdout).toContain('cur prev words cword');
    });

    it('zsh completion should include proper compdef', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete zsh`;
      const { stdout } = await exec(command);

      // Should contain compdef directive
      expect(stdout).toMatch(/#compdef \w+/);

      // Should contain completion function
      expect(stdout).toMatch(/_\w+\(\)/);

      // Should register the completion
      expect(stdout).toMatch(/compdef _\w+ \w+/);
    });

    it('fish completion should include proper complete commands', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete fish`;
      const { stdout } = await exec(command);

      // Should contain fish complete commands
      expect(stdout).toContain('complete -c');

      // Should handle command completion
      expect(stdout).toMatch(/complete -c \w+ -f/);
    });
  });

  // Test for potential bash issues (related to the user's problem)
  describe('bash-specific issue detection', () => {
    it('should generate bash script with proper escaping', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete bash`;
      const { stdout } = await exec(command);

      // Check for the actual problematic bash syntax in the requestComp assignment
      expect(stdout).not.toMatch(/requestComp="[^"]*\$\{words\[@\]:1\}/); // Should not use ${words[@]:1} in requestComp
      expect(stdout).toContain('requestComp='); // Should have proper variable assignment
      expect(stdout).toContain('complete -F'); // Should register completion properly
    });

    it('should generate bash script that handles empty parameters correctly', async () => {
      const command = `pnpm tsx examples/demo.${cliTool}.ts complete bash`;
      const { stdout } = await exec(command);

      // Should handle empty parameters
      expect(stdout).toContain(`''`); // Should add empty parameter handling
      expect(stdout).toContain('requestComp='); // Should build command properly
    });
  });
});
