import { describe, it, expect } from 'vitest';
import { promisify } from 'node:util';
import { exec as execCb } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execCb);

describe('shell integration tests', () => {
  // Support matrix testing - if TEST_SHELL is set, only test that shell
  const testShell = process.env.TEST_SHELL;
  const shells = testShell
    ? [testShell]
    : ['zsh', 'bash', 'fish', 'powershell'];
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
    // Only run syntax validation for the shells we're testing
    const syntaxTestShells = shells.filter(
      (shell) =>
        shell === 'bash' ||
        shell === 'zsh' ||
        shell === 'fish' ||
        shell === 'powershell'
    );

    syntaxTestShells.forEach((shell) => {
      it(
        `should generate syntactically valid ${shell} script`,
        async () => {
          const command = `pnpm tsx examples/demo.${cliTool}.ts complete ${shell}`;
          const { stdout } = await exec(command);

          // Write script to temp file
          const scriptPath = join(
            process.cwd(),
            `temp-${shell}-completion.${shell === 'powershell' ? 'ps1' : shell === 'fish' ? 'fish' : 'sh'}`
          );
          await writeFile(scriptPath, stdout);

          try {
            // Test syntax based on shell type
            switch (shell) {
              case 'bash':
                await exec(`bash -n ${scriptPath}`);
                break;
              case 'zsh':
                await exec(`zsh -n ${scriptPath}`);
                break;
              case 'fish':
                await exec(`fish -n ${scriptPath}`);
                break;
              case 'powershell':
                // Test PowerShell syntax with timeout to prevent hanging in CI
                const testPromise = exec(
                  `pwsh -NoProfile -Command "& { . '${scriptPath}'; exit 0 }"`
                );

                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error('PowerShell test timed out')),
                    10000
                  )
                );

                await Promise.race([testPromise, timeoutPromise]);
                break;
            }
            // If we get here, syntax is valid
            expect(true).toBe(true);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            // Provide helpful error message for bash-completion dependency
            if (shell === 'bash' && errorMessage.includes('syntax')) {
              const helpMessage = `
Bash script has syntax errors: ${errorMessage}

This might be due to missing bash-completion dependency.
To fix this, install bash-completion@2:

  brew install bash-completion@2

Then source the completion in your shell profile:
  echo 'source $(brew --prefix)/share/bash-completion/bash_completion' >> ~/.bashrc
`;
              throw new Error(helpMessage);
            }

            throw new Error(`${shell} script has syntax errors: ${error}`);
          } finally {
            // Clean up
            await unlink(scriptPath).catch(() => {});
          }
        },
        shell === 'powershell' ? 15000 : 5000
      ); // Longer timeout for PowerShell
    });
  });

  // Test shell-specific features
  describe('shell-specific functionality', () => {
    shells.forEach((shell) => {
      switch (shell) {
        case 'bash':
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
          break;

        case 'zsh':
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
          break;

        case 'fish':
          it('fish completion should include proper complete commands', async () => {
            const command = `pnpm tsx examples/demo.${cliTool}.ts complete fish`;
            const { stdout } = await exec(command);

            // Should contain fish complete commands
            expect(stdout).toContain('complete -c');

            // Should handle command completion
            expect(stdout).toMatch(/complete -c \w+ -f/);
          });
          break;

        case 'powershell':
          it('powershell completion should include proper functions', async () => {
            const command = `pnpm tsx examples/demo.${cliTool}.ts complete powershell`;
            const { stdout } = await exec(command);

            // Should contain PowerShell function definition
            expect(stdout).toContain('function __');

            // Should contain Register-ArgumentCompleter
            expect(stdout).toContain('Register-ArgumentCompleter');

            // Should handle PowerShell completion parameters
            expect(stdout).toContain('$WordToComplete');
            expect(stdout).toContain('$CommandAst');
            expect(stdout).toContain('$CursorPosition');
          });
          break;

        default:
          // For shells without specific tests, add a basic test to avoid empty suites
          it(`should generate ${shell} completion script`, async () => {
            const command = `pnpm tsx examples/demo.${cliTool}.ts complete ${shell}`;
            const { stdout } = await exec(command);
            expect(stdout).toBeTruthy();
            expect(stdout).toContain(`# ${shell} completion for`);
          });
          break;
      }
    });
  });

  // Test for potential bash issues (only run for bash)
  if (shells.includes('bash')) {
    describe('bash-specific issue detection', () => {
      it('should generate bash script with proper syntax (requires bash-completion@2)', async () => {
        const command = `pnpm tsx examples/demo.${cliTool}.ts complete bash`;
        const { stdout } = await exec(command);

        // Check that it uses the correct ${words[@]:1} syntax
        expect(stdout).toContain('${words[@]:1}'); // Should use ${words[@]:1} (requires bash-completion@2)
        expect(stdout).toContain('requestComp='); // Should have proper variable assignment
        expect(stdout).toContain('complete -F'); // Should register completion properly
        expect(stdout).toContain('_get_comp_words_by_ref'); // Should use bash-completion functions
      });

      it('should generate bash script that handles empty parameters correctly', async () => {
        const command = `pnpm tsx examples/demo.${cliTool}.ts complete bash`;
        const { stdout } = await exec(command);

        // Should handle empty parameters
        expect(stdout).toContain(`''`); // Should add empty parameter handling
        expect(stdout).toContain('requestComp='); // Should build command properly
      });
    });
  }
});
