import fs from "fs/promises";
import cac, { CAC } from "cac";
import { Callback, flagMap, Positional, positionalMap } from "./shared";
import path from "path";

const cli = cac("cac");

cli.option("--type [type]", "Choose a project type", {
  default: "node",
});
cli.option("--name <name>", "Provide your name");
cli.option("--name23 <name>", "Provide your name23");

cli.command("start").option("--port <port>", "your port");

cli.command("help");

cli.command("help config").option("--foo", "foo option");

cli.command("test dev").option("--foo", "foo option");

cli
  .command("deploy <environment> [version] [...files]")

cli.version("0.0.0");
cli.help();

cli.parse();

for (const c of [cli.globalCommand, ...cli.commands]) {
  for (const o of [...cli.globalCommand.options, ...c.options]) {
    if (o.rawName === "--type [type]") {
      flagMap.set(`${c.name} ${o.name}`, () => {
        return [
          {
            action: "standalone",
            description: "Standalone type",
          },
          {
            action: "complex",
            description: "Complex type",
          },
        ];
      });
    }
  }

  // console.log(c.args);
  if (c.name === "deploy") {
    const positionals: Positional[] = [];
    positionalMap.set(c.name, positionals);
    for (const arg of c.args) {
      const completion: Callback = async () => {
        if (arg.value === "environment") {
          return [
            {
              action: "node",
            },
            {
              action: "deno",
            },
          ];
        }
        if (arg.value === "version") {
          return [
            {
              action: "0.0.0",
            },
            {
              action: "0.0.1",
            },
          ];
        }
        if (arg.value === "files") {
          const currentDir = process.cwd();
          const files = await fs.readdir(currentDir);
          const jsonFiles = files.filter(
            (file) => path.extname(file).toLowerCase() === ".json",
          );
          return jsonFiles.map((file) => ({ action: file }));
        }
        return [];
      };

      positionals.push({
        required: arg.required,
        variadic: arg.variadic,
        completion,
      });
    }
  }
}


