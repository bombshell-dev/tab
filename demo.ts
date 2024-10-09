import fs from "fs/promises";
import cac from "cac";
import {
  Callback,
  Completion,
  flagMap,
  Positional,
  positionalMap,
} from "./shared";
import path from "path";
import tab from "./cac";

// const cli = cac("cac");

// cli.option("--type [type]", "Choose a project type", {
//   default: "node",
// });
// cli.option("--name <name>", "Provide your name");
// cli.option("--name23 <name>", "Provide your name23");

// cli.command("start").option("--port <port>", "your port");

// cli.command("help");

// cli.command("help config").option("--foo", "foo option");

// cli.command("test dev").option("--foo", "foo option");

// cli.command("deploy <environment> [version] [...files]");

// cli.version("0.0.0");
// cli.help();

// for (const c of [cli.globalCommand, ...cli.commands]) {
//   for (const o of [...cli.globalCommand.options, ...c.options]) {
//     if (o.rawName === "--type [type]") {
//       flagMap.set(`${c.name} ${o.name}`, () => {
//         return [
//           {
//             action: "standalone",
//             description: "Standalone type",
//           },
//           {
//             action: "complex",
//             description: "Complex type",
//           },
//         ];
//       });
//     }
//   }

//   // console.log(c.args);
//   if (c.name === "deploy") {
//     const positionals: Positional[] = [];
//     positionalMap.set(c.name, positionals);
//     for (const arg of c.args) {
//       const completion: Callback = async () => {
//         if (arg.value === "environment") {
//           return [
//             {
//               action: "node",
//             },
//             {
//               action: "deno",
//             },
//           ];
//         }
//         if (arg.value === "version") {
//           return [
//             {
//               action: "0.0.0",
//             },
//             {
//               action: "0.0.1",
//             },
//           ];
//         }
//         if (arg.value === "files") {
//           const currentDir = process.cwd();
//           const files = await fs.readdir(currentDir);
//           const jsonFiles = files.filter(
//             (file) => path.extname(file).toLowerCase() === ".json",
//           );
//           return jsonFiles.map((file) => ({ action: file }));
//         }
//         return [];
//       };

//       positionals.push({
//         required: arg.required,
//         variadic: arg.variadic,
//         completion,
//       });
//     }
//   }
// }

const cli = cac("vite"); // Using 'vite' as the CLI tool name

// Custom converters (placeholders)
function convertBase(value) {
  return value;
}

function convertHost(value) {
  return value;
}

// Global options
cli
  .option("-c, --config <file>", `[string] use specified config file`)
  .option("--base <path>", `[string] public base path (default: /)`, {
    type: [convertBase],
  })
  .option("-l, --logLevel <level>", `[string] info | warn | error | silent`)
  .option("--clearScreen", `[boolean] allow/disable clear screen when logging`)
  .option("-d, --debug [feat]", `[string | boolean] show debug logs`)
  .option("-f, --filter <filter>", `[string] filter debug logs`)
  .option("-m, --mode <mode>", `[string] set env mode`);

// Dev command
cli
  .command("[root]", "start dev server") // default command
  .alias("serve") // the command is called 'serve' in Vite's API
  .alias("dev") // alias to align with the script name
  .option("--host [host]", `[string] specify hostname`, { type: [convertHost] })
  .option("--port <port>", `[number] specify port`)
  .option("--open [path]", `[boolean | string] open browser on startup`)
  .option("--cors", `[boolean] enable CORS`)
  .option("--strictPort", `[boolean] exit if specified port is already in use`)
  .option(
    "--force",
    `[boolean] force the optimizer to ignore the cache and re-bundle`,
  )
  .action((root, options) => {
    console.log(`Starting dev server at ${root || "."} with options:`, options);
  });
// Build positional completions for each command using command.args
for (const c of [cli.globalCommand, ...cli.commands]) {
  // Handle options
  for (const o of [...cli.globalCommand.options, ...c.options]) {
    const optionKey = `${c.name} ${o.name}`;

    if (o.rawName.includes("--logLevel <level>")) {
      // Completion for --logLevel
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [
          { action: "info", description: "Info level logging" },
          { action: "warn", description: "Warning level logging" },
          { action: "error", description: "Error level logging" },
          { action: "silent", description: "No logging" },
        ].filter((comp) => comp.action.startsWith(toComplete));
      });
    }

    if (o.rawName.includes("--mode <mode>")) {
      // Completion for --mode
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [
          { action: "production", description: "Production mode" },
          { action: "development", description: "Development mode" },
          { action: "staging", description: "Staging mode" },
        ].filter((comp) => comp.action.startsWith(toComplete));
      });
    }

    if (o.rawName.includes("--port <port>")) {
      // Completion for --port
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [
          { action: "3000", description: "Development server port" },
          { action: "8080", description: "Alternative port" },
          { action: "80", description: "HTTP port" },
          { action: "443", description: "HTTPS port" },
          { action: "5000", description: "Common backend port" },
        ].filter((comp) => comp.action.startsWith(toComplete));
      });
    }

    if (o.rawName.includes("--host [host]")) {
      // Completion for --host
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [
          { action: "localhost", description: "Localhost" },
          { action: "0.0.0.0", description: "All interfaces" },
          { action: "127.0.0.1", description: "Loopback interface" },
        ].filter((comp) => comp.action.startsWith(toComplete));
      });
    }

    if (o.rawName.includes("--config <file>")) {
      // Completion for --config
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        const configFiles = ["vite.config.ts", "vite.config.js"].filter(
          (file) => file.startsWith(toComplete),
        );
        return configFiles.map((file) => ({ action: file }));
      });
    }

    // Add more option completions as needed
  }

  // Handle positional arguments
  if (c.args && c.args.length > 0) {
    const positionals = c.args.map((arg) => ({
      required: arg.required,
      variadic: arg.variadic,
      value: arg.value,
      completion: async (previousArgs, toComplete) => {
        if (arg.value === "root") {
          return [
            { action: "src/", description: "💣️.sh loves vite!" },
            { action: "./", description: "This one is better." },
          ];
        }
        return [];
      },
    }));

    positionalMap.set(c.name, positionals);
  }
}

tab(cli);

cli.parse();
