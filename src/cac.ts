import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import type { CAC } from 'cac';
import { Completion } from './index';
import { CompletionConfig, noopHandler } from './shared';

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
) {
  const completion = new Completion();

  // a hidden flag to track if -- is there in the raw arguments? we might need a better way to do this?
  const dashDashIndex = process.argv.indexOf('--');
  const wasDashDashProvided = dashDashIndex !== -1;

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

    // Add command to completion
    const commandName = completion.addCommand(
      isRootCommand ? '' : cmd.name,
      cmd.description || '',
      args,
      commandCompletionConfig?.handler ?? noopHandler
    );

    // Add command options
    for (const option of [...instance.globalCommand.options, ...cmd.options]) {
      // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
      const shortFlag = option.name.match(/^-([a-zA-Z]), --/)?.[1];
      const argName = option.name.replace(/^-[a-zA-Z], --/, '');

      completion.addOption(
        commandName,
        `--${argName}`, // Remove the short flag part if it exists
        option.description || '',
        commandCompletionConfig?.options?.[argName]?.handler ?? noopHandler,
        shortFlag
      );
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
        if (!wasDashDashProvided) {
          console.error(
            'Error: You need to use -- to separate completion arguments'
          );
          return;
        }
        const args: string[] = extra['--'] || [];
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
