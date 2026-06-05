import type { Command as CommanderCommand } from 'commander';
import t, { type RootCommand } from './t';

// rawArgs is available on (just) the Commander root command, but is not included in the TypeScript types.
interface CommandWithRawArgs extends CommanderCommand {
  rawArgs: string[];
}

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);

const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

function quoteIfNeeded(path: string): string {
  return path.includes(' ') ? `'${path}'` : path;
}

export default function tab(
  instance: CommanderCommand,
  completionConfig?: { completionCommandName?: string }
): RootCommand {
  const programName = instance.name();

  // Process the root command
  processRootCommand(instance);

  // Process all subcommands
  processSubcommands(instance);

  // Make a `completion` command with a required command-argument.
  const completionCommandName =
    completionConfig?.completionCommandName ?? 'complete';
  const completionCommand = instance
    .createCommand(completionCommandName)
    .description('Generate shell completion scripts')
    .addArgument(
      instance
        .createArgument('<shell>', 'Shell type for completion script')
        .choices(['zsh', 'bash', 'fish', 'powershell'])
    )
    .action((shell) => {
      t.setup(programName, x, shell);
    });
  completionCommand.copyInheritedSettings(instance);

  // Make a `complete` command for generating tab-time complete suggestions.
  const completeCommand = instance
    .createCommand('complete')
    .description('generate completion suggestions')
    .usage('complete -- [args...]')
    .argument('[args...]')
    .action((args) => {
      t.parse(args);
    });
  completeCommand.copyInheritedSettings(instance);

  if (completionCommandName !== 'complete') {
    // We have indepdendent commands so can hook them up directly.
    instance.addCommand(completionCommand);
    instance.addCommand(completeCommand, { hidden: true });
  } else {
    // We need to add a dual-use command, work out calling pattern, and dispatch.
    instance
      .command('complete')
      .description('Generate shell completion scripts')
      .argument(
        '[shell]',
        'shell type (choices: "zsh", "bash", "fish", "powershell")'
      )
      .allowExcessArguments()
      .action((shell, _options, cmd) => {
        // Work out how we are being called, by user or by script as completion handler.
        const rawArgs = (instance as CommandWithRawArgs).rawArgs;
        const completeIndex = rawArgs.indexOf('complete');
        const dashDashIndex = rawArgs.indexOf('--');

        if (
          completeIndex !== -1 &&
          dashDashIndex !== -1 &&
          dashDashIndex === completeIndex + 1
        ) {
          // Commander stripped `--`, so put it back for reparse
          completeCommand.parse(['--', ...cmd.args], { from: 'user' });
        } else {
          completionCommand.parse(shell !== undefined ? [shell] : [], {
            from: 'user',
          });
        }
      });
  }

  return t;
}

/**
 * Detect whether a commander option flag expects a value argument.
 * Options with `<value>` or `[value]` in their flags are value-taking.
 */
function optionTakesValue(flags: string): boolean {
  return flags.includes('<') || flags.includes('[');
}

/**
 * Register a commander option with the tab library, correctly setting
 * isBoolean based on whether the option takes a value.
 *
 * The tab Command.option() method infers isBoolean from the argument types:
 * - string arg → alias, isBoolean=true
 * - function arg → handler, isBoolean=false
 * So for value-taking options with an alias, we pass a no-op handler
 * and the alias separately to get isBoolean=false.
 */
function registerOption(
  tabCommand: {
    option: (
      value: string,
      description: string,
      handlerOrAlias?: ((...args: unknown[]) => void) | string,
      alias?: string
    ) => unknown;
  },
  flags: string,
  longFlag: string,
  description: string,
  shortFlag?: string
): void {
  const takesValue = optionTakesValue(flags);
  if (shortFlag) {
    if (takesValue) {
      // Pass a no-op handler to force isBoolean=false, with alias as 4th arg
      tabCommand.option(longFlag, description, () => {}, shortFlag);
    } else {
      tabCommand.option(longFlag, description, shortFlag);
    }
  } else {
    if (takesValue) {
      tabCommand.option(longFlag, description, () => {});
    } else {
      tabCommand.option(longFlag, description);
    }
  }
}

function processRootCommand(command: CommanderCommand): void {
  // Add root command options to the root t instance
  for (const option of command.options) {
    // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
    const flags = option.flags;
    const shortFlag = flags.match(/^-([a-zA-Z]), --/)?.[1];
    const longFlag = flags.match(/--([a-zA-Z0-9-]+)/)?.[1];

    if (longFlag) {
      registerOption(t, flags, longFlag, option.description || '', shortFlag);
    }
  }
}

function processSubcommands(rootCommand: CommanderCommand): void {
  // Build a map of command paths
  const commandMap = new Map<string, CommanderCommand>();

  // Collect all commands with their full paths
  collectCommands(rootCommand, '', commandMap);

  // Process each command
  for (const [path, cmd] of commandMap.entries()) {
    if (path === '') continue; // Skip root command, already processed

    // Add command using t.ts API
    const command = t.command(path, cmd.description() || '');

    // Add command options
    for (const option of cmd.options) {
      // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
      const flags = option.flags;
      const shortFlag = flags.match(/^-([a-zA-Z]), --/)?.[1];
      const longFlag = flags.match(/--([a-zA-Z0-9-]+)/)?.[1];

      if (longFlag) {
        registerOption(
          command,
          flags,
          longFlag,
          option.description || '',
          shortFlag
        );
      }
    }
  }
}

function collectCommands(
  command: CommanderCommand,
  parentPath: string,
  commandMap: Map<string, CommanderCommand>
): void {
  // Add this command to the map
  commandMap.set(parentPath, command);

  // Process subcommands
  for (const subcommand of command.commands) {
    // Skip the completion command
    if (subcommand.name() === 'complete') continue;

    // Build the full path for this subcommand
    const subcommandPath = parentPath
      ? `${parentPath} ${subcommand.name()}`
      : subcommand.name();

    // Recursively collect subcommands
    collectCommands(subcommand, subcommandPath, commandMap);
  }
}
