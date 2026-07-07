import { exec } from 'node:child_process';
import { describe, it, expect } from 'vitest';

// Verifies the command that generated completion scripts invoke to request
// suggestions. Completion is triggered by the shell only once the command name
// is resolvable (via PATH, an alias, or a shell function), so the script should
// invoke the CLI by its plain program name rather than a reconstructed,
// runtime-specific launch path. Baking in a launch path makes the script
// depend on how the CLI happened to be started, which does not hold across
// runtimes (e.g. compiled single-file binaries).

function run(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || String(error)));
      else resolve(stdout);
    });
  });
}

// Pull out the command the generated script will exec to request completions
// (the value baked in as `requestComp` / `$RequestComp`), across every shell.
function extractExecCommand(shell: string, script: string): string | null {
  let match: RegExpMatchArray | null = null;
  switch (shell) {
    case 'zsh':
    case 'bash':
      match = script.match(/requestComp="(.+?) complete --/);
      break;
    case 'fish':
      match = script.match(/set -l requestComp "(.+?) complete --/);
      break;
    case 'powershell':
      match = script.match(/\$RequestComp = "& (.+?) complete '--'/);
      break;
  }
  return match ? match[1] : null;
}

const adapters = [
  { adapter: 'commander', programName: 'myapp' },
  { adapter: 'cac', programName: 'vite' },
  { adapter: 'citty', programName: 'vite' },
] as const;

const shells = ['zsh', 'bash', 'fish', 'powershell'] as const;

describe('generated completion scripts invoke the CLI by program name', () => {
  for (const { adapter, programName } of adapters) {
    describe(`${adapter} adapter`, () => {
      for (const shell of shells) {
        it(`${shell}: requestComp uses the program name, not a runtime launch path`, async () => {
          const script = await run(
            `pnpm tsx examples/demo.${adapter}.ts complete ${shell}`
          );

          const execCommand = extractExecCommand(shell, script);
          expect(
            execCommand,
            `could not locate requestComp in generated ${shell} script`
          ).not.toBeNull();

          // The command baked into the script must be exactly the program name.
          expect(execCommand).toBe(programName);

          // A bare program name never contains any of these substrings, so
          // their presence signals a runtime-specific launch path leaking in.
          expect(execCommand).not.toContain('/');
          expect(execCommand).not.toContain('node');
          expect(execCommand).not.toContain('tsx');
          expect(execCommand).not.toContain('$bunfs');
          expect(execCommand).not.toContain('.ts');
        });
      }
    });
  }
});
