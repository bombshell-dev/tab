import { ArgDef, defineCommand } from "citty";
import * as zsh from "../zsh";
import * as bash from "../bash";
import * as fish from "../fish";
import * as powershell from "../powershell";
import { Completion } from ".";
import { CommandDef, PositionalArgDef } from "citty";

function quoteIfNeeded(path) {
  return path.includes(" ") ? `'${path}'` : path;
}

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);
const x = `${quotedExecPath} ${quotedProcessExecArgs.join(" ")} ${quotedProcessArgs[0]}`;
const completion = new Completion();

export default async function tab(instance: CommandDef) {
  const meta =
    typeof instance.meta === "function" ? await instance.meta() : await instance.meta;

  if (!meta) {
    throw new Error()
  }
  const name = meta.name
  if (!name) {
    throw new Error()
  }

  const subCommands = typeof instance.subCommands === "function" ? await instance.subCommands() : await instance.subCommands
  if (!subCommands) {
    throw new Error()
  }

  completion.addCommand(meta.name!, meta?.description ?? "", () => { });
  // Object.values(subCommands).forEach((cmd) => {
  //TODO: resolver function 
  for (const [cmd, resolvableConfig] of Object.entries(subCommands)) {
    const config = typeof resolvableConfig === "function" ? await resolvableConfig() : await resolvableConfig
    const meta = typeof config.meta === "function" ? await config.meta() : await config.meta;
    if (!meta || typeof meta?.description !== "string") {
      throw new Error("Invalid meta or missing description.");
    }
    completion.addCommand(cmd, meta.description, config.run ?? (() => { }));
    if (config.args) {
      for (const [argName, argConfig] of Object.entries(config.args)) {
        const conf = argConfig as ArgDef;
        completion.addOption(
          meta.name!,
          `--${argName}`,
          conf.description ?? "",
          () => { }
        );
      }
    }
  }
  // });

  if (instance.args) {
    for (const [argName, argConfig] of Object.entries(instance.args)) {
      const conf = argConfig as PositionalArgDef;
      completion.addOption(
        meta.name!,
        `--${argName}`,
        conf.description ?? "",
        () => { }
      );
    }
  }

  subCommands["complete"] = defineCommand({
    meta: {
      name: "complete",
      description: "Generate shell completion scripts",
    },
    args: {
      shell: {
        type: "positional",
        required: false,
        description: "Specify shell type",
      },
    },
    async run(ctx) {
      let shell: string | undefined = ctx.args.shell;
      if (shell?.startsWith("--")) {
        shell = undefined;
      }

      const extra = ctx.args._ || [];

      switch (shell) {
        case "zsh": {
          const script = zsh.generate(name, x);
          console.log(script);
          break;
        }
        case "bash": {
          const script = bash.generate(name, x);
          console.log(script);
          break;
        }
        case "fish": {
          const script = fish.generate(name, x);
          console.log(script);
          break;
        }
        case "powershell": {
          const script = powershell.generate(name, x);
          console.log(script);
          break;
        }
        default: {
          const extra = ctx.args._ || [];
          // We simply call parse (which prints completions directly)
          await completion.parse(extra, instance);
          // parse() does its own console.logs, so no return object to destructure
          return;
        }
      }
    },
  });
}
