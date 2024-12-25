import { defineCommand } from "citty";
import * as zsh from "./zsh";
import * as bash from "./bash";
import * as fish from "./fish";
import * as powershell from "./powershell";
import {
  flagMap,
  Positional,
  positionalMap,
  ShellCompDirective,
} from "./shared";

function quoteIfNeeded(path) {
  return path.includes(" ") ? `'${path}'` : path;
}

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);
const x = `${quotedExecPath} ${quotedProcessExecArgs.join(" ")} ${quotedProcessArgs[0]}`;

export default function tab(mainCommand) {
  mainCommand.subCommands["complete"] = defineCommand({
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
          const script = zsh.generate(mainCommand.meta.name, x);
          console.log(script);
          break;
        }
        case "bash": {
          const script = bash.generate(mainCommand.meta.name, x);
          console.log(script);
          break;
        }
        case "fish": {
          const script = fish.generate(mainCommand.meta.name, x);
          console.log(script);
          break;
        }
        case "powershell": {
          const script = powershell.generate(mainCommand.meta.name, x);
          console.log(script);
          break;
        }
        default: {
          const args = extra;
          let directive = ShellCompDirective.ShellCompDirectiveDefault;
          const completions: string[] = [];
          const endsWithSpace = args[args.length - 1] === "";

          if (endsWithSpace) args.pop();
          let toComplete = args[args.length - 1] || "";
          const previousArgs = args.slice(0, -1);

          let matchedCommand = mainCommand;

          if (previousArgs.length > 0) {
            const lastPrevArg = previousArgs[previousArgs.length - 1];
            if (lastPrevArg.startsWith("--")) {
              const flagCompletion = flagMap.get(lastPrevArg);
              if (flagCompletion) {
                const flagSuggestions = await flagCompletion(previousArgs, toComplete);
                completions.push(
                  ...flagSuggestions.map(
                    (comp) => `${comp.action}\t${comp.description ?? ""}`
                  )
                );
                completions.forEach((comp) => console.log(comp));
                console.log(`:${directive}`);
                return;
              }
            }
          }

          if (toComplete.startsWith("--")) {
            if (toComplete === "--") {
              const allFlags = [...flagMap.keys()];
              const specifiedFlags = previousArgs.filter(arg => arg.startsWith('--'));
              const availableFlags = allFlags.filter(flag => !specifiedFlags.includes(flag));

              completions.push(
                ...availableFlags.map(
                  (flag) =>
                    `${flag}\t${matchedCommand.args[flag.slice(2)]?.description ?? "Option"}`
                )
              );
            } else {
              const flagNamePartial = toComplete.slice(2);
              const flagKeyPartial = `--${flagNamePartial}`;

              if (flagMap.has(toComplete)) {
                const flagCompletion = flagMap.get(toComplete);
                if (flagCompletion) {
                  const flagSuggestions = await flagCompletion(previousArgs, "");
                  completions.push(
                    ...flagSuggestions.map(
                      (comp) => `${comp.action}\t${comp.description ?? ""}`
                    )
                  );
                }
              } else {
                const matchingFlags = [...flagMap.keys()].filter((flag) =>
                  flag.startsWith(flagKeyPartial)
                );

                completions.push(
                  ...matchingFlags.map(
                    (flag) =>
                      `${flag}\t${matchedCommand.args[flag.slice(2)]?.description ?? "Option"}`
                  )
                );
              }
            }

            completions.forEach((comp) => console.log(comp));
            console.log(`:${directive}`);
            return;
          }

          if (previousArgs.length === 0) {
            completions.push(
              ...Object.keys(mainCommand.subCommands || {})
                .filter((cmd) => cmd !== "complete")
                .map(
                  (cmd) =>
                    `${cmd}\t${mainCommand.subCommands[cmd]?.meta.description ?? ""}`
                )
            );
          } else {
            const positionalCompletions =
              positionalMap.get(matchedCommand.meta.name) || [];
            for (const positional of positionalCompletions) {
              const suggestions = await positional.completion(
                previousArgs,
                toComplete
              );
              completions.push(
                ...suggestions.map(
                  (comp) => `${comp.action}\t${comp.description ?? ""}`
                )
              );
            }
          }

          completions.forEach((comp) => console.log(comp));
          console.log(`:${directive}`);
        }
      }
    },
  });
}
