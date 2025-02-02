import * as zsh from "./zsh";
import * as bash from "./bash";
import * as fish from "./fish";
import * as powershell from "./powershell";
import type { CAC } from "cac";
import { Completion } from "./";

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);

const x = `${quotedExecPath} ${quotedProcessExecArgs.join(" ")} ${quotedProcessArgs[0]}`;

function quoteIfNeeded(path: string): string {
  return path.includes(" ") ? `'${path}'` : path;
}

// export default function tab(instance: CAC): void {
//   instance.command("complete [shell]").action(async (shell, extra) => {
//     switch (shell) {
//       case "zsh": {
//         const script = zsh.generate(instance.name, x);
//         console.log(script);
//         break;
//       }
//       case "bash": {
//         const script = bash.generate(instance.name, x);
//         console.log(script);
//         break;
//       }
//       case "fish": {
//         const script = fish.generate(instance.name, x);
//         console.log(script);
//         break;
//       }
//       case "powershell": {
//         const script = powershell.generate(instance.name, x);
//         console.log(script);
//         break;
//       }
//       default: {
//         const args: string[] = extra["--"];

//         instance.showHelpOnExit = false;
//         let directive = ShellCompDirective.ShellCompDirectiveDefault;

//         const endsWithSpace = args[args.length - 1] === "";
//         if (endsWithSpace) {
//           args.pop();
//         }

//         let toComplete = args[args.length - 1] || "";
//         const previousArgs = args.slice(0, -1);

//         const completions: string[] = [];

//         instance.unsetMatchedCommand();
//         instance.parse([execPath, processArgs[0], ...previousArgs], {
//           run: false,
//         });

//         const command = instance.matchedCommand ?? instance.globalCommand;

//         const options = [
//           ...new Set([
//             ...(command?.options ?? []),
//             ...instance.globalCommand.options,
//           ]),
//         ];

//         let isCompletingFlagValue = false;
//         let flagName = "";
//         let option: (typeof options)[number] | null = null;
//         const lastArg = previousArgs[previousArgs.length - 1];

//         function processOption() {
//           const matchedOption = options.find((o) =>
//             o.names.some((name) => name === flagName)
//           );

//           if (matchedOption && !matchedOption.isBoolean) {
//             isCompletingFlagValue = true;
//             option = matchedOption;
//             if (endsWithSpace) {
//               toComplete = "";
//             }
//           } else {
//             isCompletingFlagValue = false;
//             option = null;
//           }
//         }

//         if (toComplete.startsWith("--")) {
//           // Long option
//           flagName = toComplete.slice(2);
//           const equalsIndex = flagName.indexOf("=");
//           if (equalsIndex !== -1 && !endsWithSpace) {
//             // Option with '=', get the name before '='
//             flagName = flagName.slice(0, equalsIndex);
//             toComplete = toComplete.slice(toComplete.indexOf("=") + 1);
//             processOption();
//           } else if (!endsWithSpace) {
//             // If not ending with space, still typing option name
//             flagName = "";
//           } else {
//             // User pressed space after typing the option name
//             processOption();
//             toComplete = "";
//           }
//         } else if (toComplete.startsWith("-") && toComplete.length > 1) {
//           // Short option
//           flagName = toComplete.slice(1);
//           if (!endsWithSpace) {
//             // Still typing option name
//             flagName = "";
//           } else {
//             processOption();
//             toComplete = "";
//           }
//         } else if (lastArg?.startsWith("--") && !endsWithSpace) {
//           flagName = lastArg.slice(2);
//           processOption();
//         } else if (
//           lastArg?.startsWith("-") &&
//           lastArg.length > 1 &&
//           !endsWithSpace
//         ) {
//           flagName = lastArg.slice(2);
//           processOption();
//         }

//         if (isCompletingFlagValue) {
//           const flagCompletionFn = flagMap.get(
//             `${command.name} ${option?.name}`
//           );

//           if (flagCompletionFn) {
//             // Call custom completion function for the flag
//             const comps = await flagCompletionFn(previousArgs, toComplete);
//             completions.push(
//               ...comps.map(
//                 (comp) => `${comp.action}\t${comp.description ?? ""}`
//               )
//             );
//             directive = ShellCompDirective.ShellCompDirectiveNoFileComp;
//           } else {
//             // Default completion (e.g., file completion)
//             directive = ShellCompDirective.ShellCompDirectiveDefault;
//           }
//         } else if (toComplete.startsWith("-") && !endsWithSpace) {
//           const flag = toComplete.replace(/^-+/, ""); // Remove leading '-'

//           // Determine options to suggest
//           let optionsToSuggest = options.filter((o) => {
//             const equalToDefault =
//               "default" in o.config &&
//               instance.options[o.name] === o.config.default;
//             return (
//               o.names.some((name) => name.startsWith(flag)) &&
//               !(instance.options[o.name] && !equalToDefault)
//             );
//           });

//           const requiredOptions = optionsToSuggest.filter((o) => o.required);

//           if (requiredOptions.length) {
//             // Required options not yet specified
//             optionsToSuggest = requiredOptions;
//           }

//           if (optionsToSuggest.length > 0) {
//             completions.push(
//               ...optionsToSuggest.map(
//                 (o) => `--${o.name}\t${o.description ?? ""}`
//               )
//             );
//           }

//           directive = ShellCompDirective.ShellCompDirectiveNoFileComp;
//         } else {
//           instance.parse(
//             [execPath, processArgs[0], ...previousArgs, toComplete],
//             {
//               run: false,
//             }
//           );
//           const fullCommandName = args
//             .filter((arg) => !arg.startsWith("-"))
//             .join(" ");

//           for (const c of instance.commands) {
//             if (c.name === "complete") {
//               // avoid showing completions for the completion server
//               continue;
//             }
//             const fullCommandParts = fullCommandName.split(" ");
//             const commandParts: { type: "command"; value: string }[] = c.name
//               .split(" ")
//               .map((part) => ({ type: "command", value: part }));
//             const args: {
//               type: "positional";
//               position: number;
//               value: Positional;
//             }[] =
//               positionalMap.get(c.name)?.map((arg, i) => ({
//                 type: "positional",
//                 position: i,
//                 value: arg,
//               })) ?? [];
//             const parts = [...commandParts, ...args];

//             for (let i = 0; i < parts.length; i++) {
//               const fullCommandPart = fullCommandParts[i];
//               const part = parts[i];

//               if (part.type === "command") {
//                 // Command part matching
//                 if (part.value === fullCommandPart) {
//                   // Command part matches user input, continue to next part
//                   continue;
//                 } else if (
//                   !fullCommandPart ||
//                   part.value.startsWith(fullCommandPart)
//                 ) {
//                   // User is typing this command part, provide completion
//                   completions.push(`${part.value}\t${c.description ?? ""}`);
//                 }
//                 // Command part does not match, break
//                 break;
//               } else if (part.type === "positional") {
//                 const positional = part.value;
//                 // Positional argument handling
//                 if (part.value.variadic) {
//                   const comps = await positional.completion(
//                     previousArgs,
//                     toComplete
//                   );
//                   completions.push(
//                     ...comps.map(
//                       (comp) => `${comp.action}\t${comp.description ?? ""}`
//                     )
//                   );
//                   break;
//                 }
//                 if (typeof fullCommandPart !== "undefined") {
//                   // User has provided input for this positional argument
//                   if (i === fullCommandParts.length - 1 && !endsWithSpace) {
//                     // User is still typing this positional argument, provide completions
//                     const comps = await positional.completion(
//                       previousArgs,
//                       toComplete
//                     );
//                     completions.push(
//                       ...comps.map(
//                         (comp) => `${comp.action}\t${comp.description ?? ""}`
//                       )
//                     );
//                     break;
//                   } else {
//                     // Positional argument is already provided, move to next
//                     previousArgs.push(fullCommandPart);
//                     continue;
//                   }
//                 } else {
//                   // User has not provided input for this positional argument
//                   const comps = await positional.completion(
//                     previousArgs,
//                     toComplete
//                   );
//                   completions.push(
//                     ...comps.map(
//                       (comp) => `${comp.action}\t${comp.description ?? ""}`
//                     )
//                   );
//                   break;
//                 }
//               }
//             }
//           }
//         }

//         // Output completions
//         for (const comp of completions) {
//           console.log(comp.split("\n")[0].trim());
//         }
//         console.log(`:${directive}`);
//         console.error(`Completion ended with directive: ${directive}`);
//       }
//     }
//   });
// }

export default function tab(instance: CAC): Completion {
  const completion = new Completion();

  // Add all commands and their options
  for (const cmd of [instance.globalCommand, ...instance.commands]) {
    if (cmd.name === 'complete') continue; // Skip completion command

    // Get positional args info from command usage
    const args = (cmd.rawName.match(/\[.*?\]|\<.*?\>/g) || [])
      .map(arg => arg.startsWith('['));  // true if optional (wrapped in [])

    // Add command to completion
    const commandName = completion.addCommand(
      cmd.name === '@@global@@' ? '' : cmd.name,
      cmd.description || '',
      args,
      async () => []
    );

    // Add command options
    for (const option of [...instance.globalCommand.options, ...cmd.options]) {
      completion.addOption(
        commandName,
        `--${option.name}`,
        option.description || '',
        async () => []
      );
    }
  }

  instance.command("complete [shell]").action(async (shell, extra) => {
    switch (shell) {
      case "zsh": {
        const script = zsh.generate(instance.name, x);
        console.log(script);
        break;
      }
      case "bash": {
        const script = bash.generate(instance.name, x);
        console.log(script);
        break;
      }
      case "fish": {
        const script = fish.generate(instance.name, x);
        console.log(script);
        break;
      }
      case "powershell": {
        const script = powershell.generate(instance.name, x);
        console.log(script);
        break;
      }
      default: {
        const args: string[] = extra["--"];
        instance.showHelpOnExit = false;

        // Parse current command context
        instance.unsetMatchedCommand();
        instance.parse([execPath, processArgs[0], ...args], {
          run: false,
        });

        // const matchedCommand = instance.matchedCommand?.name || '';
        // const potentialCommand = args.join(' ')
        // console.log(potentialCommand)
        return completion.parse(args);
      }
    }
  });

  return completion;
}