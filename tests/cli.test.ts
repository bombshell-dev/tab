import { exec } from "child_process";
import { describe, it, expect } from "vitest";

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

describe("CLI Completion Tests cac", () => {
  it("should complete vite commands", async () => {
    const output = await runCommand("pnpm tsx demo.cac.ts complete --");
    console.log("Command Output:", output);
    expect(output).toContain("src/");
    expect(output).toContain("./");
    // expect(output).toContain('--base');
  });

  it("should complete options", async () => {
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
