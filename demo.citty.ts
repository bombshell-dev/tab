import { defineCommand, createMain } from "citty";
import tab from "./citty";
import { flagMap, positionalMap } from "./shared";

const main = defineCommand({
  meta: {
    name: "vite",
    description: "Vite CLI tool",
  },
  args: {
    config: { type: "string", description: "Use specified config file", alias: "c" },
    base: { type: "string", description: "Public base path (default: /)" },
    logLevel: { type: "string", description: "info | warn | error | silent", alias: "l" },
    clearScreen: { type: "boolean", description: "Allow/disable clear screen when logging" },
    debug: { type: "string", description: "Show debug logs", alias: "d" },
    filter: { type: "string", description: "Filter debug logs", alias: "f" },
    mode: { type: "string", description: "Set env mode", alias: "m" },
  },
  run(ctx) {
    const firstArg = ctx.args._?.[0];
    if (firstArg && devCommand?.run) {
      devCommand.run({ ...ctx, args: { ...ctx.args, root: firstArg } });
    }
  },
});

const devCommand = defineCommand({
  meta: {
    name: "dev",
    description: "Start dev server",
  },
  args: {
    root: { type: "positional", description: "Root directory", default: "." },
    host: { type: "string", description: "Specify hostname" },
    port: { type: "string", description: "Specify port" },
    open: { type: "boolean", description: "Open browser on startup" },
    cors: { type: "boolean", description: "Enable CORS" },
    strictPort: { type: "boolean", description: "Exit if specified port is already in use" },
    force: { type: "boolean", description: "Force the optimizer to ignore the cache and re-bundle" },
  },
  run({ args }) {
    const { root, port, ...options } = args;
    const parsedPort = port ? parseInt(port, 10) : undefined;

    if (!root || root === ".") {
      console.log("Suggested root directories:");
      console.log("- src/");
      console.log("- ./");
    }
  },
});

main.subCommands = { dev: devCommand };

for (const command of [main, ...Object.values(main.subCommands)]) {
  const commandName = command.meta.name;

  for (const [argName, argConfig] of Object.entries(command.args || {})) {
    const optionKey = `--${argName}`;

    if (argName === "port") {
      flagMap.set(optionKey, async (_, toComplete) => {
        const options = [
          { action: "3000", description: "Development server port" },
          { action: "8080", description: "Alternative port" },
        ];
        return toComplete
          ? options.filter(comp => comp.action.startsWith(toComplete))
          : options;
      });
    } else if (argName === "host") {
      flagMap.set(optionKey, async (_, toComplete) => {
        const options = [
          { action: "localhost", description: "Localhost" },
          { action: "0.0.0.0", description: "All interfaces" },
        ];
        return toComplete
          ? options.filter(comp => comp.action.startsWith(toComplete))
          : options;
      });
    } else if (argName === "config") {
      flagMap.set(optionKey, async (_, toComplete) => {
        const configFiles = ["vite.config.ts", "vite.config.js"].filter(
          (file) => file.startsWith(toComplete)
        );
        return configFiles.map((file) => ({ action: file }));
      });
    } else if (argName === "mode") {
      flagMap.set(optionKey, async (_, toComplete) => {
        const options = [
          { action: "development", description: "Development mode" },
          { action: "production", description: "Production mode" },
        ];
        return toComplete
          ? options.filter(comp => comp.action.startsWith(toComplete))
          : options;
      });
    } else {
      flagMap.set(optionKey, async (_, toComplete) => {
        const flag = optionKey.startsWith("--") ? optionKey.slice(2) : optionKey;
        if (!toComplete || optionKey.startsWith(toComplete)) {
          return [{ action: optionKey, description: argConfig.description }];
        }
        return [];
      });
    }
  }

  if (command.args) {
    const positionals = Object.entries(command.args)
      .filter(([, config]) => config.type === "positional")
      .map(([argName, argConfig]) => ({
        value: argName,
        required: !!argConfig.required,
        completion: async (_, toComplete) => {
          const options = [
            { action: "src/", description: "Source directory" },
            { action: "./", description: "Current directory" },
          ];
          return toComplete
            ? options.filter(comp => comp.action.startsWith(toComplete))
            : options;
        },
      }));
    positionalMap.set(commandName, positionals);
  }
}

tab(main);

const cli = createMain(main);
cli();
