import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import * as path from 'path';

// Check if fish is available
function isFishAvailable(): boolean {
  try {
    execSync('fish --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Run fish command and return output
function runFish(script: string): string {
  const result = spawnSync('fish', ['-c', script], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  return result.stdout + result.stderr;
}

// Simulate TAB completion in fish
function simulateTab(completionScript: string, commandLine: string): string[] {
  const script = `
    source (echo '${completionScript.replace(/'/g, "\\'")}' | psub)
    complete --do-complete "${commandLine}"
  `;
  const output = runFish(script);
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.trim());
}

describe.skipIf(!isFishAvailable())(
  'fish shell completion integration tests',
  () => {
    const demoCliPath = path.join(
      __dirname,
      '../examples/demo-cli-cac/demo-cli-cac.js'
    );
    let completionScript: string;

    beforeAll(() => {
      // Generate the completion script from demo-cli-cac
      const result = spawnSync('node', [demoCliPath, 'complete', 'fish'], {
        encoding: 'utf-8',
        cwd: path.dirname(demoCliPath),
      });
      completionScript = result.stdout;
    });

    it('should complete subcommands when pressing TAB after command', () => {
      const completions = simulateTab(completionScript, 'demo-cli-cac ');

      // Should contain subcommands
      expect(completions.some((c) => c.startsWith('start'))).toBe(true);
      expect(completions.some((c) => c.startsWith('build'))).toBe(true);
    });

    it('should complete flags when pressing TAB after --', () => {
      const completions = simulateTab(completionScript, 'demo-cli-cac --');

      // Should contain global flags
      expect(completions.some((c) => c.includes('--config'))).toBe(true);
      expect(completions.some((c) => c.includes('--debug'))).toBe(true);
      expect(completions.some((c) => c.includes('--help'))).toBe(true);
      expect(completions.some((c) => c.includes('--version'))).toBe(true);
    });

    it('should complete subcommand-specific flags', () => {
      const completions = simulateTab(
        completionScript,
        'demo-cli-cac start --'
      );

      // Should contain start-specific flag
      expect(completions.some((c) => c.includes('--port'))).toBe(true);
      // Should also contain global flags
      expect(completions.some((c) => c.includes('--config'))).toBe(true);
    });

    it('should complete build command flags', () => {
      const completions = simulateTab(
        completionScript,
        'demo-cli-cac build --'
      );

      // Should contain build-specific flag
      expect(completions.some((c) => c.includes('--mode'))).toBe(true);
      // Should also contain global flags
      expect(completions.some((c) => c.includes('--config'))).toBe(true);
    });

    it('should show descriptions with completions', () => {
      const completions = simulateTab(completionScript, 'demo-cli-cac ');

      // Check that descriptions are included (tab-separated)
      const startCompletion = completions.find((c) => c.startsWith('start'));
      expect(startCompletion).toContain('Start the application');

      const buildCompletion = completions.find((c) => c.startsWith('build'));
      expect(buildCompletion).toContain('Build the application');
    });

    it('should filter completions based on partial input', () => {
      const completions = simulateTab(completionScript, 'demo-cli-cac st');

      // Should only show completions starting with 'st'
      expect(completions.some((c) => c.startsWith('start'))).toBe(true);
      // 'build' should not appear
      expect(completions.some((c) => c.startsWith('build'))).toBe(false);
    });

    it('should filter flag completions based on partial input', () => {
      const completions = simulateTab(completionScript, 'demo-cli-cac --c');

      // Should show --config
      expect(completions.some((c) => c.includes('--config'))).toBe(true);
      // Should not show --debug (doesn't start with --c)
      expect(completions.some((c) => c.includes('--debug'))).toBe(false);
    });
  }
);
