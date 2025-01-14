import { exec } from "child_process";
import { describe, it, expect, test } from "vitest";

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

const cliTools = ["citty"];

describe.each(cliTools)("cli completion tests for %s", (cliTool) => {
  const commandPrefix = `pnpm tsx demo.${cliTool}.ts complete --`;

  it("should complete cli options", async () => {
    const output = await runCommand(`${commandPrefix}`);
    expect(output).toMatchSnapshot();
  });

  describe("cli option completion tests", () => {
    const optionTests = [
      { partial: "--p", expected: "--port" },
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

  describe("cli option exclusion tests", () => {
    const alreadySpecifiedTests = [
      { specified: "--config", shouldNotContain: "--config" },
    ];

    test.each(alreadySpecifiedTests)(
      "should not suggest already specified option '%s'",
      async ({ specified }) => {
        const command = `${commandPrefix} ${specified} --`;
        const output = await runCommand(command);
        expect(output).toMatchSnapshot();
      }
    );
  });

  describe("cli option value handling", () => {
    it("should resolve port value correctly", async () => {
      const command = `${commandPrefix} dev --port=3`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it("should handle conflicting options appropriately", async () => {
      const command = `${commandPrefix} --config vite.config.js --`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it("should resolve config option values correctly", async () => {
      const command = `${commandPrefix} --config vite.config`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it("should handle unknown options with no completions", async () => {
      const command = `${commandPrefix} --unknownoption`;
      const output = await runCommand(command);
      expect(output.trim()).toMatchSnapshot();
    });
  });

  describe("edge case completions for end with space", () => {
    //TOOD: remove this
    it("should suggest port values if user ends with space after `--port`", async () => {
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

  describe("positional argument completions", () => {
    it("should complete single positional argument when ending with space (vite src/)", async () => {
      const command = `${commandPrefix} vite src/ ""`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });

    it("should complete multiple positional arguments when ending with space (vite src/ ./)", async () => {
      const command = `${commandPrefix} vite ""`;
      const output = await runCommand(command);
      expect(output).toMatchSnapshot();
    });
  });
});
