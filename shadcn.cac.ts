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

const cli = cac("shadcn"); // Using 'shadcn' as the CLI tool name

// Global options
cli
  .option("-c, --cwd [cwd]", `[string] the working directory. defaults to the current directory.`)
  .option("-h, --help", `display help for command`);

// Init command
cli
  .command("init", "initialize your project and install dependencies")
  .option("-d, --defaults", `[boolean] use default values i.e new-york, zinc, and css variables`, { default: false })
  .option("-f, --force", `[boolean] force overwrite of existing components.json`, { default: false })
  .option("-y, --yes", `[boolean] skip confirmation prompt`, { default: false })
  .action((options) => {
    console.log(`Initializing project with options:`, options);
  });

// Add command
cli
  .command("add [...components]", "add a component to your project")
  .option("-y, --yes", `[boolean] skip confirmation prompt`, { default: false })
  .option("-o, --overwrite", `[boolean] overwrite existing files`, { default: false })
  .option("-a, --all", `[boolean] add all available components`, { default: false })
  .option("-p, --path [path]", `[string] the path to add the component to`)
  .action((components, options) => {
    console.log(`Adding components:`, components, `with options:`, options);
  });

// Build positional completions for each command using command.args
for (const c of [cli.globalCommand, ...cli.commands]) {
  // Handle options
  for (const o of [...cli.globalCommand.options, ...c.options]) {
    const optionKey = `${c.name} ${o.name}`;

    if (o.rawName.includes("--cwd <cwd>")) {
      // Completion for --cwd (common working directories)
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [
          { action: "./apps/www", description: "Default app directory" },
          { action: "./apps/admin", description: "Admin app directory" },
        ].filter((comp) => comp.action.startsWith(toComplete));
      });
    }

    if (o.rawName.includes("--defaults")) {
      // Completion for --defaults (show info for default setup)
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [{ action: "true", description: "Use default values for setup" }];
      });
    }

    if (o.rawName.includes("--path <path>")) {
      // Completion for --path (common component paths)
      flagMap.set(optionKey, async (previousArgs, toComplete) => {
        return [
          { action: "src/components", description: "Main components directory" },
          { action: "src/ui", description: "UI components directory" },
        ].filter((comp) => comp.action.startsWith(toComplete));
      });
    }
  }

  // Handle positional arguments
  if (c.name === "add" && c.args && c.args.length > 0) {
    const componentChoices = [
      "accordion", "alert", "alert-dialog", "aspect-ratio", "avatar",
      "badge", "button", "calendar", "card", "checkbox"
    ];
    const positionals = c.args.map((arg) => ({
      required: arg.required,
      variadic: arg.variadic,
      value: arg.value,
      completion: async (previousArgs, toComplete) => {
        // if (arg.value === "root") {
          return componentChoices
            // TODO: a bug here that toComplete is equal to "add" which then makes filter not work, we should omit toComplete and add it to previous args if the endsWithSpace is true  
            // .filter((comp) => comp.startsWith(toComplete))
            .map((comp) => ({ action: comp, description: `Add ${comp} component` }));
        // }
        // return [];
      },
    }));

    positionalMap.set(c.name, positionals);
  }
}

// Initialize tab completion
tab(cli);

cli.parse();

