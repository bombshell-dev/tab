import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import type { CAC } from 'cac';
import { assertDoubleDashes } from './shared';
import { OptionHandler } from './t';
import { CompletionConfig } from './shared';
import t from './t';

const noopOptionHandler: OptionHandler = function () {};

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);

const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

function quoteIfNeeded(path: string): string {
  return path.includes(' ') ? `'${path}'` : path;
}

export default async function tab(
  instance: CAC,
  completionConfig?: CompletionConfig
): Promise<any> {
  // Add all commands and their options
  for (const cmd of [instance.globalCommand, ...instance.commands]) {
    if (cmd.name === 'complete') continue; // Skip completion command

    // Get positional args info from command usage
    const args = (cmd.rawName.match(/\[.*?\]|<.*?>/g) || []).map((arg) =>
      arg.startsWith('[')
    ); // true if optional (wrapped in [])

    const isRootCommand = cmd.name === '@@global@@';
    const commandCompletionConfig = isRootCommand
      ? completionConfig
      : completionConfig?.subCommands?.[cmd.name];

    // Add command to completion using t.ts API
    const commandName = isRootCommand ? '' : cmd.name;
    const command = isRootCommand
      ? t
      : t.command(commandName, cmd.description || '');

    // Set args for the command
    if (command) {
      // Extract argument names from command usage
      const argMatches =
        cmd.rawName.match(/<([^>]+)>|\[\.\.\.([^\]]+)\]/g) || [];
      const argNames = argMatches.map((match) => {
        if (match.startsWith('<') && match.endsWith('>')) {
          return match.slice(1, -1); // Remove < >
        } else if (match.startsWith('[...') && match.endsWith(']')) {
          return match.slice(4, -1); // Remove [... ]
        }
        return match;
      });

      args.forEach((variadic, index) => {
        const argName = argNames[index] || `arg${index}`;
        const argHandler = commandCompletionConfig?.args?.[argName];
        if (argHandler) {
          command.argument(argName, argHandler, variadic);
        } else {
          command.argument(argName, undefined, variadic);
        }
      });
    }

    // Add command options
    for (const option of [...instance.globalCommand.options, ...cmd.options]) {
      // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
      const shortFlag = option.name.match(/^-([a-zA-Z]), --/)?.[1];
      const argName = option.name.replace(/^-[a-zA-Z], --/, '');

      // Add option using t.ts API
      const targetCommand = isRootCommand ? t : command;
      if (targetCommand) {
        targetCommand.option(
          argName, // Store just the option name without -- prefix
          option.description || '',
          commandCompletionConfig?.options?.[argName] ?? noopOptionHandler,
          shortFlag
        );
      }
    }
  }

  instance.command('complete [shell]').action(async (shell, extra) => {
    switch (shell) {
      case 'zsh': {
        const script = zsh.generate(instance.name, x);
        console.log(script);
        break;
      }
      case 'bash': {
        const script = bash.generate(instance.name, x);
        console.log(script);
        break;
      }
      case 'fish': {
        const script = fish.generate(instance.name, x);
        console.log(script);
        break;
      }
      case 'powershell': {
        const script = powershell.generate(instance.name, x);
        console.log(script);
        break;
      }
      default: {
        assertDoubleDashes(instance.name);

        const args: string[] = extra['--'] || [];
        instance.showHelpOnExit = false;

        // Parse current command context
        instance.unsetMatchedCommand();
        instance.parse([execPath, processArgs[0], ...args], {
          run: false,
        });

        // Use t.ts parse method instead of completion.parse
        return t.parse(args);
      }
    }
  });

  return t;
}
