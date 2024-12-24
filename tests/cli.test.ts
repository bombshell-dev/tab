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

describe("CLI Completion Tests for CAC", () => {
  it("Completes Vite Commands Correctly", async () => {
    const output = await runCommand("pnpm tsx demo.cac.ts complete --");
    console.log("Command Output:", output);
    expect(output).toContain("src/");
    expect(output).toContain("./");
    // expect(output).toContain('--base');
  });

  it("Completes CLI Options Correctly", async () => {
    const output = await runCommand("pnpm tsx demo.cac.ts complete -- --");
    console.log("Command Output:", output);
    expect(output).toContain("--port");
    expect(output).toContain("--config");
    expect(output).toContain("--base");
    expect(output).toContain("--logLevel");
    expect(output).toContain("--filter");
    expect(output).toContain("--mode");
  });
});

describe("CLI Option Completion for Partial Inputs", () => {
  const optionTests = [
    { partial: "--p", expected: "--port" },
  ];

  test.each(optionTests)(
    "Completes Option When Given Partial Input '%s'",
    async ({ partial, expected }) => {
      const command = `pnpm tsx demo.cac.ts complete -- ${partial}`;
      const output = await runCommand(command);
      console.log(`Complete ${partial} Output:`, output);
      expect(output).toContain(expected);
    }
  );
});

describe("CLI Option Completion When Options Are Already Specified", () => {
  const alreadySpecifiedTests = [
    { specified: "--port", shouldNotContain: "--port" },
  ];

  test.each(alreadySpecifiedTests)(
    "Does Not Suggest Already Specified Option '%s'",
    async ({ specified, shouldNotContain }) => {
      const command = `pnpm tsx demo.cac.ts complete -- ${specified} --`;
      const output = await runCommand(command);
      console.log(`Already Specified ${specified} Output:`, output);
      expect(output).not.toContain(shouldNotContain);
    }
  );
});

describe("CLI Option Value Handling", () => {

  it("Resolves Port Value Correctly", async () => {
    const command = "pnpm tsx demo.cac.ts complete -- --port 3";
    const output = await runCommand(command);
    console.log("Conflicting Options Output:", output);
    expect(output).toContain("3000");
  });

  it("Handles Conflicting Options Appropriately", async () => {
    const command = "pnpm tsx demo.cac.ts complete -- --port 3000 --";
    const output = await runCommand(command);
    console.log("Conflicting Options Output:", output);
    expect(output).not.toContain("--port");
    expect(output).toContain("--config");
    // expect(output).toContain("--base");
  });

  it("Resolves Config Option Values Correctly", async () => {
    const command = "pnpm tsx demo.cac.ts complete -- --port 3000 --config vite.config";
    const output = await runCommand(command);
    console.log("Conflicting Options Output:", output);
    expect(output).toContain("vite.config.ts");
    expect(output).toContain("vite.config.js");
  });

  it("Gracefully Handles Unknown Options with No Completions", async () => {
    const command = "pnpm tsx demo.cac.ts complete -- --unknownoption";
    const output = await runCommand(command);
    console.log("No Completion Available Output:", output);
    expect(output.trim()).toMatch(/^(:\d+)?$/);
  });
});
