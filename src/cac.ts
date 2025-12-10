import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import type { CAC } from 'cac';
import { assertDoubleDashes } from './shared';
import { CompletionConfig } from './shared';
import t, { RootCommand } from './t';

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);

const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

// Regex to detect if an option takes a value (has <required> or [optional] parameters)
const VALUE_OPTION_RE = /<[^>]+>|\[[^\]]+\]/;

function quoteIfNeeded(path: string): string {
  return path.includes(' ') ? `'${path}'` : path;
}

export default async function tab(
  instance: CAC,
  completionConfig?: CompletionConfig
): Promise<RootCommand> {
  for (const cmd of [instance.globalCommand, ...instance.commands]) {
    if (cmd.name === 'complete') continue;

    const args = (cmd.rawName.match(/\[.*?\]|<.*?>/g) || []).map((arg) =>
      arg.startsWith('[')
    ); // true if optional (wrapped in [])

    const isRootCommand = cmd.name === '@@global@@';
    const commandCompletionConfig = isRootCommand
      ? completionConfig
      : completionConfig?.subCommands?.[cmd.name];

    // command
    const commandName = isRootCommand ? '' : cmd.name;
    const command = isRootCommand
      ? t
      : t.command(commandName, cmd.description || '');

    // args (if has positional arguments)
    if (command) {
      const argMatches =
        cmd.rawName.match(/<([^>]+)>|\[\.\.\.([^\]]+)\]/g) || [];
      const argNames = argMatches.map((match) => {
        if (match.startsWith('<') && match.endsWith('>')) {
          return match.slice(1, -1);
        } else if (match.startsWith('[...') && match.endsWith(']')) {
          return match.slice(4, -1);
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

    // options
    for (const option of [...instance.globalCommand.options, ...cmd.options]) {
      // short flag (if exists)
      const shortFlag = option.rawName.match(/^-([a-zA-Z]), --/)?.[1];
      const argName = option.name;

      const targetCommand = isRootCommand ? t : command;
      if (targetCommand) {
        const handler = commandCompletionConfig?.options?.[argName];

        // takes value (if has <> or [] in rawName, or is marked as required)
        const takesValue =
          option.required || VALUE_OPTION_RE.test(option.rawName);

        if (handler) {
          if (shortFlag) {
            targetCommand.option(
              argName,
              option.description || '',
              handler,
              shortFlag
            );
          } else {
            targetCommand.option(argName, option.description || '', handler);
          }
        } else if (takesValue) {
          // value option (if takes value but no custom handler)
          if (shortFlag) {
            targetCommand.option(
              argName,
              option.description || '',
              async () => [],
              shortFlag
            );
          } else {
            targetCommand.option(
              argName,
              option.description || '',
              async () => []
            );
          }
        } else {
          // boolean flag (if no custom handler and doesn't take value)
          if (shortFlag) {
            targetCommand.option(argName, option.description || '', shortFlag);
          } else {
            targetCommand.option(argName, option.description || '');
          }
        }
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

        // command context
        instance.unsetMatchedCommand();
        instance.parse([execPath, processArgs[0], ...args], {
          run: false,
        });

        return t.parse(args);
      }
    }
  });

  return t;
}
