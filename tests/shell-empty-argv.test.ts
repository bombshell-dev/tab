import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as bash from '../src/bash';
import * as fish from '../src/fish';
import * as powershell from '../src/powershell';
import * as zsh from '../src/zsh';

type ExecResult = {
  code: number | string | null;
  stdout: string;
  stderr: string;
};

type Fixture = {
  dir: string;
  scriptPath: string;
  capturePath: string;
};

type CompletionCase = {
  label: string;
  expected: string[];

  // zsh / bash simulation state
  words: string[];
  current: number;

  // fish / PowerShell simulation state
  line: string;
};

const cases: CompletionCase[] = [
  {
    label: 'root empty completion',
    words: ['demo', ''],
    current: 2,
    line: 'demo ',
    expected: [''],
  },
  {
    label: 'typed root prefix',
    words: ['demo', 'd'],
    current: 2,
    line: 'demo d',
    expected: ['d'],
  },
  {
    label: 'next word after completed command',
    words: ['demo', 'dev', ''],
    current: 3,
    line: 'demo dev ',
    expected: ['dev', ''],
  },
];

function execFileAsync(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env: {
          ...process.env,
          ...env,
        },
        timeout: 10_000,
      },
      (error, stdout, stderr) => {
        resolve({
          code: error ? ((error as NodeJS.ErrnoException).code ?? 1) : 0,
          stdout,
          stderr,
        });
      }
    );
  });
}

async function findExecutable(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const result = await execFileAsync(candidate, ['--version']);

    if (result.code === 0) {
      return candidate;
    }
  }

  return null;
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, `''`)}'`;
}

async function createFixture(
  shell: 'bash' | 'fish' | 'powershell' | 'zsh'
): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), 'tab-shell-empty-argv-'));
  const helperPath = join(dir, 'capture-argv.cjs');
  const scriptPath = join(dir, `${shell}.completion`);
  const capturePath = join(dir, 'captured-argv.jsonl');

  await writeFile(
    helperPath,
    `
  const fs = require('node:fs');
  
  const capturePath = process.env.TAB_ARGV_CAPTURE;
  if (!capturePath) {
    throw new Error('TAB_ARGV_CAPTURE is not set');
  }
  
  const separatorIndex = process.argv.indexOf('--');
  const completionArgs =
    separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);
  
  fs.appendFileSync(capturePath, JSON.stringify(completionArgs) + '\\n');
  
  // Emit one matching completion so bash's compgen exits successfully.
  // The argv capture is what this test really asserts.
  process.stdout.write('dev\\tStart dev server\\n:4\\n');
  `.trimStart()
  );

  const posixExec = `${shQuote(process.execPath)} ${shQuote(helperPath)}`;
  const powerShellExec = `${psQuote(process.execPath)} ${psQuote(helperPath)}`;

  const generatedScript =
    shell === 'bash'
      ? bash.generate('demo', posixExec)
      : shell === 'fish'
        ? fish.generate('demo', posixExec)
        : shell === 'powershell'
          ? powershell.generate('demo', powerShellExec)
          : zsh.generate('demo', posixExec);

  await writeFile(scriptPath, generatedScript);

  return {
    dir,
    scriptPath,
    capturePath,
  };
}

async function readLastCapturedArgs(capturePath: string): Promise<string[]> {
  const content = await readFile(capturePath, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  const lastLine = lines.at(-1);

  if (!lastLine) {
    throw new Error(`No argv capture found in ${capturePath}`);
  }

  return JSON.parse(lastLine);
}

async function withFixture(
  shell: 'bash' | 'fish' | 'powershell' | 'zsh',
  fn: (fixture: Fixture) => Promise<void>
) {
  const fixture = await createFixture(shell);

  try {
    await fn(fixture);
  } finally {
    await rm(fixture.dir, {
      recursive: true,
      force: true,
    });
  }
}

async function assertZshCase(
  shell: string,
  fixture: Fixture,
  testCase: CompletionCase
) {
  const wordsLiteral = `(${testCase.words.map(shQuote).join(' ')})`;

  const script = `
function compdef() { :; }
function _describe() { return 1; }
function _arguments() { return 0; }

source ${shQuote(fixture.scriptPath)}

words=${wordsLiteral}
CURRENT=${testCase.current}

_demo >/dev/null
`;

  const result = await execFileAsync(shell, ['-f', '-c', script], {
    TAB_ARGV_CAPTURE: fixture.capturePath,
  });

  expect(result.code, result.stderr).toBe(0);
  await expect(readLastCapturedArgs(fixture.capturePath)).resolves.toEqual(
    testCase.expected
  );
}

async function assertBashCase(
  shell: string,
  fixture: Fixture,
  testCase: CompletionCase
) {
  const wordsLiteral = `(${testCase.words.map(shQuote).join(' ')})`;

  const script = `
function _get_comp_words_by_ref() {
  local names=("$@")
  local len=\${#names[@]}

  local curvar=\${names[$((len - 4))]}
  local prevvar=\${names[$((len - 3))]}
  local wordsvar=\${names[$((len - 2))]}
  local cwordvar=\${names[$((len - 1))]}

  printf -v "$curvar" '%s' "\${COMP_WORDS[$COMP_CWORD]}"
  printf -v "$prevvar" '%s' "\${COMP_WORDS[$((COMP_CWORD - 1))]}"
  eval "$wordsvar=(\\"\\\${COMP_WORDS[@]}\\")"
  printf -v "$cwordvar" '%s' "$COMP_CWORD"
}

function compopt() { :; }

source ${shQuote(fixture.scriptPath)}

COMP_WORDS=${wordsLiteral}
COMP_CWORD=${testCase.current - 1}

__demo_complete >/dev/null
`;

  const result = await execFileAsync(shell, ['-c', script], {
    TAB_ARGV_CAPTURE: fixture.capturePath,
  });

  expect(
    result.code,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  ).toBe(0);
  await expect(readLastCapturedArgs(fixture.capturePath)).resolves.toEqual(
    testCase.expected
  );
}

async function assertFishCase(
  shell: string,
  fixture: Fixture,
  testCase: CompletionCase
) {
  const script = `
set -gx TAB_ARGV_CAPTURE ${shQuote(fixture.capturePath)}
source ${shQuote(fixture.scriptPath)}

complete --do-complete ${shQuote(testCase.line)} >/dev/null
`;

  const result = await execFileAsync(shell, ['-c', script]);

  expect(result.code, result.stderr).toBe(0);
  await expect(readLastCapturedArgs(fixture.capturePath)).resolves.toEqual(
    testCase.expected
  );
}

async function assertPowerShellCase(
  shell: string,
  fixture: Fixture,
  testCase: CompletionCase
) {
  const cursorPosition = testCase.line.length;

  const script = `
$env:TAB_ARGV_CAPTURE = ${psQuote(fixture.capturePath)}
. ${psQuote(fixture.scriptPath)}

[System.Management.Automation.CommandCompletion]::CompleteInput(
  ${psQuote(testCase.line)},
  ${cursorPosition},
  $null
) | Out-Null
`;

  const result = await execFileAsync(shell, [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script,
  ]);

  expect(result.code, result.stderr).toBe(0);
  await expect(readLastCapturedArgs(fixture.capturePath)).resolves.toEqual(
    testCase.expected
  );
}

describe('generated shell argv protocol', () => {
  it('zsh sends exactly one empty arg for root empty completion', async () => {
    const shell = await findExecutable(['zsh']);

    if (!shell) {
      console.warn('Skipping zsh argv protocol test: zsh is not installed');
      return;
    }

    await withFixture('zsh', async (fixture) => {
      for (const testCase of cases) {
        await assertZshCase(shell, fixture, testCase);
      }
    });
  });

  it('bash sends exactly one empty arg for root empty completion', async () => {
    const shell = await findExecutable(['bash']);

    if (!shell) {
      console.warn('Skipping bash argv protocol test: bash is not installed');
      return;
    }

    await withFixture('bash', async (fixture) => {
      for (const testCase of cases) {
        await assertBashCase(shell, fixture, testCase);
      }
    });
  });

  it('fish sends exactly one empty arg for root empty completion', async () => {
    const shell = await findExecutable(['fish']);

    if (!shell) {
      console.warn('Skipping fish argv protocol test: fish is not installed');
      return;
    }

    await withFixture('fish', async (fixture) => {
      for (const testCase of cases) {
        await assertFishCase(shell, fixture, testCase);
      }
    });
  });

  it('PowerShell sends exactly one empty arg for root empty completion', async () => {
    const shell = await findExecutable(['pwsh', 'powershell']);

    if (!shell) {
      console.warn(
        'Skipping PowerShell argv protocol test: pwsh/powershell is not installed'
      );
      return;
    }

    await withFixture('powershell', async (fixture) => {
      for (const testCase of cases) {
        await assertPowerShellCase(shell, fixture, testCase);
      }
    });
  });
});
