import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import type { Command as CommanderCommand } from 'commander';
import { Completion } from './';
import { requireDashDashSeparator } from './shared';

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);

const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

function quoteIfNeeded(path: string): string {
  return path.includes(' ') ? `'${path}'` : path;
}

export default function tab(instance: CommanderCommand): Completion {
  const completion = new Completion();
  const programName = instance.name();

  // Process the root command
  processRootCommand(completion, instance, programName);

  // Process all subcommands
  processSubcommands(completion, instance, programName);

  // Add the complete command
  instance
    .command('complete [shell]')
    .allowUnknownOption(true)
    .description('Generate shell completion scripts')
    .action(async (shell, options) => {
      // Check if there are arguments after --
      const dashDashIndex = process.argv.indexOf('--');
      let extra: string[] = [];

      if (dashDashIndex !== -1) {
        extra = process.argv.slice(dashDashIndex + 1);
        // If shell is actually part of the extra args, adjust accordingly
        if (shell && extra.length > 0 && shell === '--') {
          shell = undefined;
        }
      }

      switch (shell) {
        case 'zsh': {
          const script = zsh.generate(programName, x);
          console.log(script);
          break;
        }
        case 'bash': {
          const script = bash.generate(programName, x);
          console.log(script);
          break;
        }
        case 'fish': {
          const script = fish.generate(programName, x);
          console.log(script);
          break;
        }
        case 'powershell': {
          const script = powershell.generate(programName, x);
          console.log(script);
          break;
        }
        case 'debug': {
          // Debug mode to print all collected commands
          const commandMap = new Map<string, CommanderCommand>();
          collectCommands(instance, '', commandMap);
          console.log('Collected commands:');
          for (const [path, cmd] of commandMap.entries()) {
            console.log(
              `- ${path || '<root>'}: ${cmd.description() || 'No description'}`
            );
          }
          break;
        }
        default: {
          if (!requireDashDashSeparator(programName)) {
            return;
          }

          // Parse current command context for autocompletion
          return completion.parse(extra);
        }
      }
    });

  return completion;
}

function processRootCommand(
  completion: Completion,
  command: CommanderCommand,
  programName: string
): void {
  // Add the root command
  completion.addCommand('', command.description() || '', [], async () => []);

  // Add root command options
  for (const option of command.options) {
    // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
    const flags = option.flags;
    const shortFlag = flags.match(/^-([a-zA-Z]), --/)?.[1];
    const longFlag = flags.match(/--([a-zA-Z0-9-]+)/)?.[1];

    if (longFlag) {
      completion.addOption(
        '',
        `--${longFlag}`,
        option.description || '',
        async () => [],
        shortFlag
      );
    }
  }
}

function processSubcommands(
  completion: Completion,
  rootCommand: CommanderCommand,
  programName: string
): void {
  // Build a map of command paths
  const commandMap = new Map<string, CommanderCommand>();

  // Collect all commands with their full paths
  collectCommands(rootCommand, '', commandMap);

  // Process each command
  for (const [path, cmd] of commandMap.entries()) {
    if (path === '') continue; // Skip root command, already processed

    // Extract positional arguments from usage
    const usage = cmd.usage();
    const args = (usage?.match(/\[.*?\]|<.*?>/g) || []).map((arg) =>
      arg.startsWith('[')
    ); // true if optional (wrapped in [])

    // Add command to completion
    completion.addCommand(path, cmd.description() || '', args, async () => []);

    // Add command options
    for (const option of cmd.options) {
      // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
      const flags = option.flags;
      const shortFlag = flags.match(/^-([a-zA-Z]), --/)?.[1];
      const longFlag = flags.match(/--([a-zA-Z0-9-]+)/)?.[1];

      if (longFlag) {
        completion.addOption(
          path,
          `--${longFlag}`,
          option.description || '',
          async () => [],
          shortFlag
        );
      }
    }

    // For commands with subcommands, add a special handler
    if (cmd.commands.length > 0) {
      const subcommandNames = cmd.commands
        .filter((subcmd) => subcmd.name() !== 'complete')
        .map((subcmd) => ({
          value: subcmd.name(),
          description: subcmd.description() || '',
        }));

      if (subcommandNames.length > 0) {
        const cmdObj = completion.commands.get(path);
        if (cmdObj) {
          cmdObj.handler = async () => subcommandNames;
        }
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
