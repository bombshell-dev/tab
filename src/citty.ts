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
  const meta = await resolve(instance.meta);

  if (!meta) {
    throw new Error("Invalid meta.");
  }
  const name = meta.name;
  if (!name) {
    throw new Error("Invalid meta or missing name.");
  }

  const subCommands = await resolve(instance.subCommands);
  if (!subCommands) {
    throw new Error("Invalid or missing subCommands.");
  }

  completion.addCommand(meta.name!, meta?.description ?? "", () => { });

  for (const [cmd, resolvableConfig] of Object.entries(subCommands)) {
    const config = await resolve(resolvableConfig);
    const meta = await resolve(config.meta);

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
          await completion.parse(extra, instance);
          return;
        }
      }
    },
  });
}

async function resolve<T>(resolvable: T | (() => T | Promise<T>)): Promise<T> {
  return typeof resolvable === "function" ? await (resolvable as () => T | Promise<T>)() : resolvable;
}