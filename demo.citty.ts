import { defineCommand, createMain } from "citty";
// import { tab } from "./citty";
const main = defineCommand({
  meta: {
    name: "vite",
    description: "Vite CLI tool",
  },
  args: {
    config: {
      type: "string",
      description: "Use specified config file",
      alias: "c",
    },
    base: {
      type: "string",
      description: "Public base path (default: /)",
    },
    logLevel: {
      type: "string",
      description: "info | warn | error | silent",
      alias: "l",
    },
    clearScreen: {
      type: "boolean",
      description: "Allow/disable clear screen when logging",
    },
    debug: {
      type: "string",
      description: "Show debug logs",
      alias: "d",
    },
    filter: {
      type: "string",
      description: "Filter debug logs",
      alias: "f",
    },
    mode: {
      type: "string",
      description: "Set env mode",
      alias: "m",
    },
  },
  run(ctx) {
    if (ctx.args._?.[0] !== "complete" && devCommand.run) {
      devCommand.run(ctx);
    } else if (!devCommand.run) {
      console.error("Error: dev command is not defined.");
    }
  },
});

const devCommand = defineCommand({
  meta: {
    name: "dev",
    description: "Start dev server",
  },
  args: {
    root: {
      type: "positional",
      description: "Root directory",
      required: false,
      default: ".",
    },
    host: {
      type: "string",
      description: "Specify hostname",
    },
    port: {
      type: "string",
      description: "Specify port",
    },
    open: {
      type: "boolean",
      description: "Open browser on startup",
    },
    cors: {
      type: "boolean",
      description: "Enable CORS",
    },
    strictPort: {
      type: "boolean",
      description: "Exit if specified port is already in use",
    },
    force: {
      type: "boolean",
      description: "Force the optimizer to ignore the cache and re-bundle",
    },
  },
  run({ args }) {
    const { root, port, ...options } = args;
    const parsedPort = port ? parseInt(port, 10) : undefined;

    if (args._?.[0] !== "complete") {
      if (!root || root === ".") {
        console.log("Suggested root directories:");
        console.log("- src/");
        console.log("- ./");
      }

      const formattedOptions = { ...options, port: parsedPort };
      if (formattedOptions._) {
        formattedOptions["--"] = formattedOptions._;
        delete formattedOptions._;
      }

      const cleanedOptions = Object.fromEntries(
        Object.entries(formattedOptions).filter(([_, v]) => v !== undefined)
      );

      console.log(
        `Starting dev server at ${root || "."} with options:`,
        cleanedOptions
      );
    }
  },
});

main.subCommands = {
  dev: devCommand,
};

// tab(main);

const cli = createMain(main);
cli();
