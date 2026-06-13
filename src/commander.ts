import type { Command as CommanderCommand } from 'commander';
import t, { Command as TabCommand, type RootCommand } from './t';

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
    .description('Generate completion suggestions')
    .usage('-- [args...]')
    .argument('[args...]')
    .action((args) => {
      if (completionCommandName !== 'complete') {
        // Check for user trying to generate shell completion script, since not using usual tab overloaded complete `command`.
        const rawArgs = (instance as CommandWithRawArgs).rawArgs;
        if (args.length === 1 && !rawArgs.includes('--'))
          instance.error(
            `error: completion requests are called like \`complete -- [args]\`.\n(Did you mean \`${completionCommandName} ${args[0]}\` to generate shell script?)`
          );
      }

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
      .action((_shell, _options, cmd) => {
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
          completionCommand.parse(cmd.args, {
            from: 'user',
          });
        }
      });
  }

  // Now we have added complete and completion command...
  // Process the root command
  processRootCommand(instance);

  // Process all subcommands
  processSubcommands(instance);

  return t;
}

function processOptions(t: TabCommand, cmd: CommanderCommand): void {
  // visibleOptions handles hidden options and built-in help option
  const visibleOptions = cmd.createHelp().visibleOptions(cmd);
  for (const option of visibleOptions) {
    // Commander has at least one of short and long option flags, but can have just one.
    // Commander also allows special case, shortish long and long like '--ws, --workspace'.
    // Remove the leading dashes to get the names.
    let shortName = option.short?.slice(1);
    if (shortName && shortName[0] === '-') shortName = undefined; // ignore shortish long
    const longName = option.long?.slice(2);
    if (longName) {
      const optionTakesValue = option.required || option.optional;
      if (optionTakesValue) {
        t.option(longName, option.description, () => {}, shortName);
      } else {
        t.option(longName, option.description, shortName);
      }
    }
  }
}

function processRootCommand(command: CommanderCommand): void {
  processOptions(t, command);
  processArguments(t, command);
}

function processArguments(tabCommand: TabCommand, cmd: CommanderCommand): void {
  for (const arg of cmd.registeredArguments) {
    const choices = arg.argChoices;
    if (choices?.length) {
      tabCommand.argument(
        arg.name(),
        (complete) => {
          for (const choice of choices) complete(choice, '');
        },
        arg.variadic
      );
    } else {
      tabCommand.argument(arg.name(), undefined, arg.variadic);
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

    // Add command options and arguments
    processOptions(command, cmd);
    processArguments(command, cmd);
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
  // visibleCommands handles hidden commands and built-in help command
  const visibleCommands = command.createHelp().visibleCommands(command);
  for (const subcommand of visibleCommands) {
    // Build the full path for this subcommand
    const subcommandPath = parentPath
      ? `${parentPath} ${subcommand.name()}`
      : subcommand.name();

    // Recursively collect subcommands
    collectCommands(subcommand, subcommandPath, commandMap);
  }
}
