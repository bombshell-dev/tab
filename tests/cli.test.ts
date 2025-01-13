// TODO: convert to inlineSnapShot
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

const cliTools = ["cac", "citty"];

describe.each(cliTools)("cli completion tests for %s", (cliTool) => {
  const commandPrefix = `pnpm tsx demo.${cliTool}.ts complete --`;

  // it("should complete positional commands", async () => {
  //   const output = await runCommand(commandPrefix);
  //   console.log(`[${cliTool}] Command Output:`, output);
  //   expect(output).toContain("src/");
  //   expect(output).toContain("./");
  //   // expect(output).toContain('--base');
  // });

  it("should complete cli options", async () => {
    const output = await runCommand(`${commandPrefix} --`);
    console.log(`[${cliTool}] Command Output:`, output);
    expect(output).toContain("--port");
    expect(output).toContain("--config");
    expect(output).toContain("--base");
    expect(output).toContain("--logLevel");
    expect(output).toContain("--filter");
    expect(output).toContain("--mode");
  });

  describe("cli option completion tests", () => {
    const optionTests = [
      { partial: "--p", expected: "--port" },
    ];

    test.each(optionTests)(
      "should complete option for partial input '%s'",
      async ({ partial, expected }) => {
        const command = `${commandPrefix} ${partial}`;
        const output = await runCommand(command);
        console.log(`[${cliTool}] Complete ${partial} Output:`, output);
        expect(output).toContain(expected);
      }
    );
  });

  describe("cli option exclusion tests", () => {
    const alreadySpecifiedTests = [
      { specified: "--port", shouldNotContain: "--port" },
    ];

    test.each(alreadySpecifiedTests)(
      "should not suggest already specified option '%s'",
      async ({ specified, shouldNotContain }) => {
        const command = `${commandPrefix} ${specified} --`;
        const output = await runCommand(command);
        console.log(`[${cliTool}] Already Specified ${specified} Output:`, output);
        expect(output).not.toContain(shouldNotContain);
        // expect(output).toContain("--base");
      }
    );
  });

  describe("cli option value handling", () => {

    it("should resolve port value correctly", async () => {
      const command = `${commandPrefix} --port 3`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] Port Value Output:`, output);
      expect(output).toContain("3000");
    });

    it("should handle conflicting options appropriately", async () => {
      const command = `${commandPrefix} --port 3000 --`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] Conflicting Options Output:`, output);
      expect(output).not.toContain("--port");
      expect(output).toContain("--config");
      // expect(output).toContain("--base");
    });

    it("should resolve config option values correctly", async () => {
      const command = `${commandPrefix} --port 3000 --config vite.config`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] Config Option Output:`, output);
      expect(output).toContain("vite.config.ts");
      expect(output).toContain("vite.config.js");
    });

    it("should handle unknown options with no completions", async () => {
      const command = `${commandPrefix} --unknownoption`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] No Completion Available Output:`, output);
      expect(output.trim()).toMatch(/^(:\d+)?$/);
    });
  });

  describe("edge case completions for end with space", () => {

    it("should suggest port values if user ends with space after `--port`", async () => {
      const command = `${commandPrefix} dev --port ""`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] End With Space (port) Output:`, output);
      expect(output).toContain("3000");
    });

    it("should keep suggesting the --port option if user typed partial but didn't end with space", async () => {
      const command = `${commandPrefix} dev --po`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] Partial Option (no space) Output:`, output);
      expect(output).toContain("--port");
    });

    it("should suggest port values if user typed `--port=` and hasn't typed a space or value yet", async () => {
      const command = `${commandPrefix} dev --port ""`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] --port= (no space) Output:`, output);
      expect(output).toContain("3000");
    });

  });

  describe("positional argument completions", () => {
    it("should complete single positional argument when ending with space (vite src/)", async () => {
      const command = `${commandPrefix} vite src/ ""`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] Single Positional Output:`, output);

      expect(output).toContain("src/");
      expect(output).toContain("./");
    });

    it("should complete multiple positional arguments when ending with space (vite src/ ./)", async () => {
      const command = `${commandPrefix} vite src/ ""`;
      const output = await runCommand(command);
      console.log(`[${cliTool}] Multiple Positional Output:`, output);

      expect(output).toContain("./");
    });
  });
});