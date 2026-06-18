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
        timeout: 20_000,
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

function formatArgs(args: string[]): string {
  return JSON.stringify(args);
}

function logShellCase(
  shell: string,
  testCase: CompletionCase,
  expected: string[],
  received: string[]
) {
  const passed = JSON.stringify(received) === JSON.stringify(expected);
  const status = passed ? 'PASS' : 'FAIL';

  console.log(
    `[${shell}] ${status} ${testCase.label}\n` +
      `  expected: ${formatArgs(expected)}\n` +
      `  received: ${formatArgs(received)}`
  );
}

async function createFixture(
  shell: 'bash' | 'fish' | 'powershell' | 'zsh'
): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), 'tab-shell-empty-argv-'));
  const helperPath = join(dir, 'capture-argv.cjs');
  const scriptPath = join(
    dir,
    shell === 'powershell' ? 'powershell.completion.ps1' : `${shell}.completion`
  );
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

// Emit one matching completion so shells that use native filtering still exit successfully.
// The argv capture is what this test actually asserts.
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
  let content: string;

  try {
    content = await readFile(capturePath, 'utf8');
  } catch (error) {
    throw new Error(
      `No argv capture found at ${capturePath}. The generated completer probably did not invoke the fake backend.`,
      {
        cause: error,
      }
    );
  }

  const lines = content.trim().split(/\r?\n/);
  const lastLine = lines.at(-1);

  if (!lastLine) {
    throw new Error(`Argv capture file was empty: ${capturePath}`);
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

  expect(
    result.code,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  ).toBe(0);

  const capturedArgs = await readLastCapturedArgs(fixture.capturePath);

  logShellCase('zsh', testCase, testCase.expected, capturedArgs);

  expect(
    capturedArgs,
    `zsh did not send expected argv for case: ${testCase.label}`
  ).toEqual(testCase.expected);
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

  const capturedArgs = await readLastCapturedArgs(fixture.capturePath);

  logShellCase('bash', testCase, testCase.expected, capturedArgs);

  expect(
    capturedArgs,
    `bash did not send expected argv for case: ${testCase.label}`
  ).toEqual(testCase.expected);
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

  expect(
    result.code,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  ).toBe(0);

  const capturedArgs = await readLastCapturedArgs(fixture.capturePath);

  logShellCase('fish', testCase, testCase.expected, capturedArgs);

  expect(
    capturedArgs,
    `fish did not send expected argv for case: ${testCase.label}`
  ).toEqual(testCase.expected);
}

async function assertPowerShellCase(
  shell: string,
  fixture: Fixture,
  testCase: CompletionCase
) {
  const cursorPosition = testCase.line.length;
  const wordToComplete = testCase.line.endsWith(' ')
    ? ''
    : (testCase.line.split(/\s+/).at(-1) ?? '');

  const script = `
$env:TAB_ARGV_CAPTURE = ${psQuote(fixture.capturePath)}
. ${psQuote(fixture.scriptPath)}

$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput(
  ${psQuote(testCase.line)},
  [ref]$tokens,
  [ref]$errors
)

$commandAst = $ast.EndBlock.Statements[0].PipelineElements[0]

& $__demoCompleterBlock ${psQuote(wordToComplete)} $commandAst ${cursorPosition} | Out-Null
`;

  const result = await execFileAsync(
    shell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    {
      TAB_ARGV_CAPTURE: fixture.capturePath,
    }
  );

  expect(
    result.code,
    `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  ).toBe(0);

  const capturedArgs = await readLastCapturedArgs(fixture.capturePath);

  logShellCase('powershell', testCase, testCase.expected, capturedArgs);

  expect(
    capturedArgs,
    `PowerShell did not send expected argv for case: ${testCase.label}`
  ).toEqual(testCase.expected);
}

async function collectCaseFailures(
  shellName: string,
  casesToRun: CompletionCase[],
  runCase: (testCase: CompletionCase) => Promise<void>
): Promise<string[]> {
  const failures: string[] = [];

  for (const testCase of casesToRun) {
    try {
      await runCase(testCase);
    } catch (error) {
      failures.push(
        `[${shellName}] ${testCase.label}\n${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return failures;
}

describe('generated shell argv protocol', () => {
  it('zsh sends the expected argv for every completion case', async () => {
    const shell = await findExecutable(['zsh']);

    if (!shell) {
      console.warn('Skipping zsh argv protocol test: zsh is not installed');
      return;
    }

    let failures: string[] = [];

    await withFixture('zsh', async (fixture) => {
      failures = await collectCaseFailures('zsh', cases, (testCase) =>
        assertZshCase(shell, fixture, testCase)
      );
    });

    expect(failures.join('\n\n')).toBe('');
  });

  it('bash sends the expected argv for every completion case', async () => {
    const shell = await findExecutable(['bash']);

    if (!shell) {
      console.warn('Skipping bash argv protocol test: bash is not installed');
      return;
    }

    let failures: string[] = [];

    await withFixture('bash', async (fixture) => {
      failures = await collectCaseFailures('bash', cases, (testCase) =>
        assertBashCase(shell, fixture, testCase)
      );
    });

    expect(failures.join('\n\n')).toBe('');
  });

  it('fish sends the expected argv for every completion case', async () => {
    const shell = await findExecutable(['fish']);

    if (!shell) {
      console.warn('Skipping fish argv protocol test: fish is not installed');
      return;
    }

    let failures: string[] = [];

    await withFixture('fish', async (fixture) => {
      failures = await collectCaseFailures('fish', cases, (testCase) =>
        assertFishCase(shell, fixture, testCase)
      );
    });

    expect(failures.join('\n\n')).toBe('');
  });

  it('PowerShell sends the expected argv for every completion case', async () => {
    const shell = await findExecutable(['pwsh', 'powershell']);

    if (!shell) {
      console.warn(
        'Skipping PowerShell argv protocol test: pwsh/powershell is not installed'
      );
      return;
    }

    let failures: string[] = [];

    await withFixture('powershell', async (fixture) => {
      failures = await collectCaseFailures('powershell', cases, (testCase) =>
        assertPowerShellCase(shell, fixture, testCase)
      );
    });

    expect(failures.join('\n\n')).toBe('');
  }, 30_000);
});
