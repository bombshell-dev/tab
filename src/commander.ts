import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import type { Command as CommanderCommand } from 'commander';
import t, { RootCommand } from './t';
import { assertDoubleDashes } from './shared';

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);

const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

function quoteIfNeeded(path: string): string {
  return path.includes(' ') ? `'${path}'` : path;
}

export default function tab(instance: CommanderCommand): RootCommand {
  const programName = instance.name();

  // Process the root command
  processRootCommand(instance, programName);

  // Process all subcommands
  processSubcommands(instance, programName);

  // Add the complete command for normal shell script generation
  instance
    .command('complete [shell]')
    .description('Generate shell completion scripts')
    .action(async (shell) => {
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
          console.error(`Unknown shell: ${shell}`);
          console.error('Supported shells: zsh, bash, fish, powershell');
          process.exit(1);
        }
      }
    });

  // Override the parse method to handle completion requests before normal parsing
  const originalParse = instance.parse.bind(instance);
  instance.parse = function (argv?: readonly string[], options?: any) {
    const args = argv || process.argv;
    const completeIndex = args.findIndex((arg) => arg === 'complete');
    const dashDashIndex = args.findIndex((arg) => arg === '--');

    if (
      completeIndex !== -1 &&
      dashDashIndex !== -1 &&
      dashDashIndex > completeIndex
    ) {
      // This is a completion request, handle it directly
      const extra = args.slice(dashDashIndex + 1);

      // Handle the completion directly
      assertDoubleDashes(programName);
      t.parse(extra);
      return instance;
    }

    // Normal parsing
    return originalParse(argv, options);
  };

  return t;
}

function processRootCommand(
  command: CommanderCommand,
  programName: string
): void {
  // Add root command options to the root t instance
  for (const option of command.options) {
    // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
    const flags = option.flags;
    const shortFlag = flags.match(/^-([a-zA-Z]), --/)?.[1];
    const longFlag = flags.match(/--([a-zA-Z0-9-]+)/)?.[1];

    if (longFlag) {
      if (shortFlag) {
        t.option(longFlag, option.description || '', shortFlag);
      } else {
        t.option(longFlag, option.description || '');
      }
    }
  }
}

function processSubcommands(
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

    // Add command using t.ts API
    const command = t.command(path, cmd.description() || '');

    // Add command options
    for (const option of cmd.options) {
      // Extract short flag from the name if it exists (e.g., "-c, --config" -> "c")
      const flags = option.flags;
      const shortFlag = flags.match(/^-([a-zA-Z]), --/)?.[1];
      const longFlag = flags.match(/--([a-zA-Z0-9-]+)/)?.[1];

      if (longFlag) {
        if (shortFlag) {
          command.option(longFlag, option.description || '', shortFlag);
        } else {
          command.option(longFlag, option.description || '');
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
