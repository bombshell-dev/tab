import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { generate as generateBash } from "../src/bash";
import { generate as generateFish } from "../src/fish";
import { generate as generatePowerShell } from "../src/powershell";
import { generate as generateZsh } from "../src/zsh";

type ShellName = "bash" | "zsh" | "fish" | "powershell";

interface ContractCase {
  name: string;
  commandLine: string;
  words: string[];
  current?: number;
  expected: string[];
}

const cases: ContractCase[] = [
  {
    name: "root empty word",
    commandLine: "demo ",
    words: ["demo", ""],
    current: 2,
    expected: [""],
  },
  {
    name: "root prefix",
    commandLine: "demo d",
    words: ["demo", "d"],
    current: 2,
    expected: ["d"],
  },
  {
    name: "after subcommand space",
    commandLine: "demo dev ",
    words: ["demo", "dev", ""],
    current: 3,
    expected: ["dev", ""],
  },
  {
    name: "flag value empty word",
    commandLine: "demo dev --mode ",
    words: ["demo", "dev", "--mode", ""],
    current: 4,
    expected: ["dev", "--mode", ""],
  },
  {
    name: "flag value prefix",
    commandLine: "demo dev --mode p",
    words: ["demo", "dev", "--mode", "p"],
    current: 4,
    expected: ["dev", "--mode", "p"],
  },
];

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }

  tempDirs = [];
});

function createFixture(shell: ShellName) {
  const dir = mkdtempSync(join(tmpdir(), `tab-${shell}-argv-`));
  tempDirs.push(dir);

  const argLogPath = join(dir, "args.log");
  const spyPath = join(dir, "spy.mjs");
  const scriptPath = join(dir, `demo.${shell}`);

  writeFileSync(
    spyPath,
    `
import { appendFileSync } from "node:fs";

appendFileSync(
  process.env.TAB_ARG_LOG,
  JSON.stringify(process.argv.slice(2)) + "\\n",
);

// No completions; only the directive.
// We only care about what argv reached this process.
process.stdout.write(":4\\n");
`,
  );

  const exec = `${process.execPath} ${spyPath}`;

  const generated =
    shell === "bash"
      ? generateBash("demo", exec)
      : shell === "zsh"
        ? generateZsh("demo", exec)
        : shell === "fish"
          ? generateFish("demo", exec)
          : generatePowerShell("demo", exec);

  writeFileSync(scriptPath, generated);

  return {
    dir,
    argLogPath,
    spyPath,
    scriptPath,
  };
}

function hasCommand(command: string, args: string[] = ["--version"]): boolean {
  const result = spawnSync(command, args, {
    stdio: "ignore",
  });

  return result.status === 0;
}

function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function readPayloads(argLogPath: string): string[][] {
  const raw = readFileSync(argLogPath, "utf8").trim();

  if (!raw) {
    return [];
  }

  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const argv = JSON.parse(line) as string[];
      const separatorIndex = argv.indexOf("--");

      if (separatorIndex === -1) {
        return argv;
      }

      return argv.slice(separatorIndex + 1);
    });
}

function expectLastPayload(argLogPath: string, expected: string[]) {
  const payloads = readPayloads(argLogPath);
  expect(payloads.length).toBeGreaterThan(0);
  expect(payloads[payloads.length - 1]).toEqual(expected);
}

describe("generated shell argv contract", () => {
  describe.skipIf(!hasCommand("zsh"))("zsh", () => {
    for (const item of cases) {
      it(item.name, () => {
        const fixture = createFixture("zsh");
        const zshWords = item.words.map(shQuote).join(" ");

        const runner = `
source ${shQuote(fixture.scriptPath)}

# Avoid needing real zsh completion UI functions.
compadd() { :; }
_describe() { return 1; }
_arguments() { return 0; }

export TAB_ARG_LOG=${shQuote(fixture.argLogPath)}

words=(${zshWords})
CURRENT=${item.current ?? item.words.length}

_demo >/dev/null 2>&1 || true
`;

        const result = spawnSync("zsh", ["-fc", runner], {
          encoding: "utf8",
        });

        expect(result.status).toBe(0);
        expectLastPayload(fixture.argLogPath, item.expected);
      });
    }
  });

  describe.skipIf(!hasCommand("bash"))("bash", () => {
    for (const item of cases) {
      it(item.name, () => {
        const fixture = createFixture("bash");
        const bashWords = item.words.map(shQuote).join(" ");
        const cur = item.words[item.words.length - 1] ?? "";
        const prev = item.words[item.words.length - 2] ?? "";

        const runner = `
source ${shQuote(fixture.scriptPath)}

# Avoid requiring bash-completion to be installed.
_get_comp_words_by_ref() {
  while [[ $# -gt 0 && "$1" == -* ]]; do
    if [[ "$1" == "-n" ]]; then
      shift 2
    else
      shift
    fi
  done

  local cur_var="$1"
  local prev_var="$2"
  local words_var="$3"
  local cword_var="$4"

  printf -v "$cur_var" "%s" "$TEST_CUR"
  printf -v "$prev_var" "%s" "$TEST_PREV"
  eval "$words_var=(\\"\\\${TEST_WORDS[@]}\\")"
  printf -v "$cword_var" "%s" "$TEST_CWORD"
}

# compopt fails outside a real programmable completion context.
compopt() { :; }

export TAB_ARG_LOG=${shQuote(fixture.argLogPath)}

TEST_WORDS=(${bashWords})
TEST_CUR=${shQuote(cur)}
TEST_PREV=${shQuote(prev)}
TEST_CWORD=${item.words.length - 1}

__demo_complete >/dev/null 2>&1 || true
`;

        const result = spawnSync("bash", ["-c", runner], {
          encoding: "utf8",
        });

        expect(result.status).toBe(0);
        expectLastPayload(fixture.argLogPath, item.expected);
      });
    }
  });

  describe.skipIf(!hasCommand("fish"))("fish", () => {
    for (const item of cases) {
      it(item.name, () => {
        const fixture = createFixture("fish");

        const runner = `
set -gx TAB_ARG_LOG ${shQuote(fixture.argLogPath)}

function demo
end

source ${shQuote(fixture.scriptPath)}

# Clear possible calls caused while sourcing.
echo -n "" > $TAB_ARG_LOG

complete --do-complete ${shQuote(item.commandLine)} >/dev/null 2>&1
`;

        const result = spawnSync("fish", ["-c", runner], {
          encoding: "utf8",
        });

        expect(result.status).toBe(0);
        expectLastPayload(fixture.argLogPath, item.expected);
      });
    }
  });

  describe.skipIf(!hasCommand("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion"]))(
    "powershell",
    () => {
      for (const item of cases) {
        it(item.name, () => {
          const fixture = createFixture("powershell");

          const cursor = item.commandLine.length;

          const runner = `
$env:TAB_ARG_LOG = ${psQuote(fixture.argLogPath)}
. ${psQuote(fixture.scriptPath)}

try {
  [System.Management.Automation.CommandCompletion]::CompleteInput(
    ${psQuote(item.commandLine)},
    ${cursor},
    $null
  ) | Out-Null
} catch {
  # The generated completer may reference interactive-only APIs after it
  # calls the completion command. The argv log is what this test audits.
}
`;

          const result = spawnSync(
            "pwsh",
            ["-NoProfile", "-Command", runner],
            {
              encoding: "utf8",
            },
          );

          expect(result.status).toBe(0);
          expectLastPayload(fixture.argLogPath, item.expected);
        });
      }
    },
  );
});