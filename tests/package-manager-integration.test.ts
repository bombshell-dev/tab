import { describe, it, expect } from 'vitest';
import { promisify } from 'node:util';
import { exec as execCb } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execCb);

describe('package manager integration tests', () => {
  const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];
  const shells = ['zsh', 'bash', 'fish', 'powershell'];

  describe('package manager completion script generation', () => {
    packageManagers.forEach((pm) => {
      shells.forEach((shell) => {
        it(`should generate ${shell} completion script for ${pm}`, async () => {
          const command = `pnpm tsx bin/cli.ts ${pm} ${shell}`;

          try {
            const { stdout, stderr } = await exec(command);

            // Should have output
            expect(stdout).toBeTruthy();
            expect(stdout.length).toBeGreaterThan(100);

            // Should contain shell-specific markers
            expect(stdout).toContain(`# ${shell} completion for`);

            // Should contain package manager name
            expect(stdout).toContain(pm);

            // Should not have errors
            expect(stderr).toBe('');
          } catch (error) {
            throw new Error(
              `Failed to generate ${shell} script for ${pm}: ${error}`
            );
          }
        });
      });
    });
  });

  // Test package manager completion functionality
  describe('package manager completion functionality', () => {
    packageManagers.forEach((pm) => {
      describe(`${pm} completion`, () => {
        it('should handle basic command completion', async () => {
          const command = `pnpm tsx bin/cli.ts ${pm} complete -- install`;

          try {
            const { stdout, stderr } = await exec(command);

            // Should have some output (completions or directive)
            expect(stdout).toBeTruthy();

            // Should end with completion directive
            expect(stdout.trim()).toMatch(/:\d+$/);

            // Should not have errors
            expect(stderr).toBe('');
          } catch (error) {
            throw new Error(`Failed ${pm} completion test: ${error}`);
          }
        });

        it('should handle script completion', async () => {
          const command = `pnpm tsx bin/cli.ts ${pm} complete -- run`;

          try {
            const { stdout, stderr } = await exec(command);

            // Should have output
            expect(stdout).toBeTruthy();
            expect(stdout.trim()).toMatch(/:\d+$/);
            expect(stderr).toBe('');
          } catch (error) {
            throw new Error(`Failed ${pm} script completion: ${error}`);
          }
        });

        it('should handle no match scenarios', async () => {
          const command = `pnpm tsx bin/cli.ts ${pm} complete -- nonexistentcommand`;

          try {
            const { stdout, stderr } = await exec(command);

            // Should have output (even if no matches)
            expect(stdout).toBeTruthy();
            expect(stdout.trim()).toMatch(/:\d+$/);
            expect(stderr).toBe('');
          } catch (error) {
            throw new Error(`Failed ${pm} no-match test: ${error}`);
          }
        });
      });
    });
  });

  // Test bash-specific package manager issues
  describe('bash package manager completion validation', () => {
    packageManagers.forEach((pm) => {
      it(`should generate syntactically valid bash completion for ${pm}`, async () => {
        const command = `pnpm tsx bin/cli.ts ${pm} bash`;
        const { stdout } = await exec(command);

        // Write script to temp file
        const scriptPath = join(process.cwd(), `temp-${pm}-bash-completion.sh`);
        await writeFile(scriptPath, stdout);

        try {
          // Test bash syntax with -n flag (syntax check only)
          await exec(`bash -n ${scriptPath}`);
          // If we get here, syntax is valid
          expect(true).toBe(true);
        } catch (error) {
          throw new Error(`${pm} bash script has syntax errors: ${error}`);
        } finally {
          // Clean up
          await unlink(scriptPath).catch(() => {});
        }
      });

      it(`should generate bash completion for ${pm} without problematic syntax`, async () => {
        const command = `pnpm tsx bin/cli.ts ${pm} bash`;
        const { stdout } = await exec(command);

        // Check for the actual problematic bash syntax in the requestComp assignment
        expect(stdout).not.toMatch(/requestComp="[^"]*\$\{words\[@\]:1\}/); // Should not use ${words[@]:1} in requestComp
        expect(stdout).toContain('complete -F'); // Should register completion properly

        // Should contain package manager specific function
        expect(stdout).toMatch(
          new RegExp(`__${pm.replace('-', '_')}_complete\\(\\)`)
        );
      });
    });
  });

  describe('package manager completion registration', () => {
    shells.forEach((shell) => {
      it(`should generate ${shell} completion with proper registration for all package managers`, async () => {
        for (const pm of packageManagers) {
          const command = `pnpm tsx bin/cli.ts ${pm} ${shell}`;
          const { stdout } = await exec(command);

          switch (shell) {
            case 'bash':
              expect(stdout).toMatch(/complete -F __\w+_complete/);
              expect(stdout).toContain(pm); // Should register for the specific package manager
              break;
            case 'zsh':
              expect(stdout).toMatch(/#compdef \w+/);
              expect(stdout).toMatch(/compdef _\w+ \w+/);
              break;
            case 'fish':
              expect(stdout).toContain('complete -c');
              expect(stdout).toContain(pm);
              break;
            case 'powershell':
              expect(stdout).toContain('Register-ArgumentCompleter');
              expect(stdout).toContain(pm);
              break;
          }
        }
      });
    });
  });

  // Test error handling
  describe('package manager error handling', () => {
    it('should handle unsupported package manager', async () => {
      const command = `pnpm tsx bin/cli.ts unsupported complete -- test`;

      try {
        await exec(command);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Unsupported package manager');
      }
    });

    it('should handle missing -- separator', async () => {
      const command = `pnpm tsx bin/cli.ts pnpm complete test`;

      try {
        await exec(command);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain("Expected '--' followed by command");
      }
    });
  });

  // Test specific package manager features
  describe('package manager specific features', () => {
    it('should handle pnpm-specific commands', async () => {
      const command = `pnpm tsx bin/cli.ts pnpm complete -- dlx`;

      try {
        const { stdout, stderr } = await exec(command);
        expect(stdout).toBeTruthy();
        expect(stdout.trim()).toMatch(/:\d+$/);
        expect(stderr).toBe('');
      } catch (error) {
        throw new Error(`Failed pnpm dlx completion: ${error}`);
      }
    });

    it('should handle yarn-specific commands', async () => {
      const command = `pnpm tsx bin/cli.ts yarn complete -- workspace`;

      try {
        const { stdout, stderr } = await exec(command);
        expect(stdout).toBeTruthy();
        expect(stdout.trim()).toMatch(/:\d+$/);
        expect(stderr).toBe('');
      } catch (error) {
        throw new Error(`Failed yarn workspace completion: ${error}`);
      }
    });

    it('should handle npm-specific commands', async () => {
      const command = `pnpm tsx bin/cli.ts npm complete -- audit`;

      try {
        const { stdout, stderr } = await exec(command);
        expect(stdout).toBeTruthy();
        expect(stdout.trim()).toMatch(/:\d+$/);
        expect(stderr).toBe('');
      } catch (error) {
        throw new Error(`Failed npm audit completion: ${error}`);
      }
    });

    it('should handle bun-specific commands', async () => {
      const command = `pnpm tsx bin/cli.ts bun complete -- create`;

      try {
        const { stdout, stderr } = await exec(command);
        expect(stdout).toBeTruthy();
        expect(stdout.trim()).toMatch(/:\d+$/);
        expect(stderr).toBe('');
      } catch (error) {
        throw new Error(`Failed bun create completion: ${error}`);
      }
    });
  });
});
