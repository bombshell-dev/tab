// Shell directive constants
const ShellCompDirective = {
  ShellCompDirectiveError: 1 << 0,
  ShellCompDirectiveNoSpace: 1 << 1,
  ShellCompDirectiveNoFileComp: 1 << 2,
  ShellCompDirectiveFilterFileExt: 1 << 3,
  ShellCompDirectiveFilterDirs: 1 << 4,
  ShellCompDirectiveKeepOrder: 1 << 5,
  shellCompDirectiveMaxValue: 1 << 6,
  ShellCompDirectiveDefault: 0,
};

export type OptionsMap = Map<string, Option>;

type Complete = (value: string, description: string) => void;

export type OptionHandler = (
  this: Option,
  complete: Complete,
  options: OptionsMap
) => void;

// Completion result types
export type Completion = {
  description?: string;
  value: string;
};

export type ArgumentHandler = (
  this: Argument,
  complete: Complete,
  options: OptionsMap
) => void;

export class Argument {
  name: string;
  variadic: boolean;
  command: Command;
  handler?: ArgumentHandler;

  constructor(
    command: Command,
    name: string,
    handler?: ArgumentHandler,
    variadic: boolean = false
  ) {
    this.command = command;
    this.name = name;
    this.handler = handler;
    this.variadic = variadic;
  }
}

export class Option {
  value: string;
  description: string;
  command: Command;
  handler?: OptionHandler;
  alias?: string;
  isBoolean?: boolean;

  constructor(
    command: Command,
    value: string,
    description: string,
    handler?: OptionHandler,
    alias?: string,
    isBoolean?: boolean
  ) {
    this.command = command;
    this.value = value;
    this.description = description;
    this.handler = handler;
    this.alias = alias;
    this.isBoolean = isBoolean;
  }
}

export class Command {
  value: string;
  description: string;
  options = new Map<string, Option>();
  arguments = new Map<string, Argument>();
  parent?: Command;

  constructor(value: string, description: string) {
    this.value = value;
    this.description = description;
  }

  option(
    value: string,
    description: string,
    handler?: OptionHandler,
    alias?: string,
    isBoolean?: boolean
  ) {
    const option = new Option(
      this,
      value,
      description,
      handler,
      alias,
      isBoolean
    );
    this.options.set(value, option);
    return this;
  }

  argument(name: string, handler?: ArgumentHandler, variadic: boolean = false) {
    const arg = new Argument(this, name, handler, variadic);
    this.arguments.set(name, arg);
    return this;
  }
}

import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import assert from 'node:assert';

export class RootCommand extends Command {
  commands = new Map<string, Command>();
  completions: Completion[] = [];
  directive = ShellCompDirective.ShellCompDirectiveDefault;

  constructor() {
    super('', '');
  }

  command(value: string, description: string) {
    const c = new Command(value, description);
    this.commands.set(value, c);
    return c;
  }

  // Utility method to strip options from args for command matching
  private stripOptions(args: string[]): string[] {
    const parts: string[] = [];
    let i = 0;

    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('-')) {
        i++; // Skip the option

        // Check if this option expects a value (not boolean)
        // We need to check across all commands since we don't know which command context we're in yet
        let isBoolean = false;

        // Check root command options
        const rootOption = this.findOption(this, arg);
        if (rootOption) {
          isBoolean = rootOption.isBoolean ?? false;
        } else {
          // Check all subcommand options
          for (const [, command] of this.commands) {
            const option = this.findOption(command, arg);
            if (option) {
              isBoolean = option.isBoolean ?? false;
              break;
            }
          }
        }

        // Only skip the next argument if this is not a boolean option and the next arg doesn't start with -
        if (!isBoolean && i < args.length && !args[i].startsWith('-')) {
          i++; // Skip the option value
        }
      } else {
        parts.push(arg);
        i++;
      }
    }

    return parts;
  }

  // Find the appropriate command based on args
  private matchCommand(args: string[]): [Command, string[]] {
    args = this.stripOptions(args);
    const parts: string[] = [];
    let remaining: string[] = [];
    let matched: Command = this;

    for (let i = 0; i < args.length; i++) {
      const k = args[i];
      parts.push(k);
      const potential = this.commands.get(parts.join(' '));

      if (potential) {
        matched = potential;
      } else {
        remaining = args.slice(i, args.length);
        break;
      }
    }

    return [matched, remaining];
  }

  // Determine if we should complete flags
  private shouldCompleteFlags(
    lastPrevArg: string | undefined,
    toComplete: string,
    endsWithSpace: boolean
  ): boolean {
    // Always complete if the current token starts with a dash
    if (toComplete.startsWith('-')) {
      return true;
    }

    // If the previous argument was an option, check if it expects a value
    if (lastPrevArg?.startsWith('-')) {
      // Find the option to check if it's boolean
      let option = this.findOption(this, lastPrevArg);
      if (!option) {
        // Check all subcommand options
        for (const [, command] of this.commands) {
          option = this.findOption(command, lastPrevArg);
          if (option) break;
        }
      }

      // If it's a boolean option, don't try to complete its value
      if (option && option.isBoolean) {
        return false;
      }

      // Non-boolean options expect values
      return true;
    }

    return false;
  }

  // Determine if we should complete commands
  private shouldCompleteCommands(
    toComplete: string,
    endsWithSpace: boolean
  ): boolean {
    return !toComplete.startsWith('-');
  }

  // Handle flag completion (names and values)
  private handleFlagCompletion(
    command: Command,
    previousArgs: string[],
    toComplete: string,
    endsWithSpace: boolean,
    lastPrevArg: string | undefined
  ) {
    // Handle flag value completion
    let optionName: string | undefined;
    let valueToComplete = toComplete;

    if (toComplete.includes('=')) {
      const [flag, value] = toComplete.split('=');
      optionName = flag;
      valueToComplete = value || '';
    } else if (lastPrevArg?.startsWith('-')) {
      optionName = lastPrevArg;
    }

    if (optionName) {
      const option = this.findOption(command, optionName);
      if (option?.handler) {
        const suggestions: Completion[] = [];
        option.handler.call(
          option,
          (value: string, description: string) =>
            suggestions.push({ value, description }),
          command.options
        );

        this.completions = toComplete.includes('=')
          ? suggestions.map((s) => ({
              value: `${optionName}=${s.value}`,
              description: s.description,
            }))
          : suggestions;
      }
      return;
    }

    // Handle flag name completion
    if (toComplete.startsWith('-')) {
      const isShortFlag =
        toComplete.startsWith('-') && !toComplete.startsWith('--');
      const cleanToComplete = toComplete.replace(/^-+/, '');

      for (const [name, option] of command.options) {
        if (
          isShortFlag &&
          option.alias &&
          `-${option.alias}`.startsWith(toComplete)
        ) {
          this.completions.push({
            value: `-${option.alias}`,
            description: option.description,
          });
        } else if (!isShortFlag && name.startsWith(cleanToComplete)) {
          this.completions.push({
            value: `--${name}`,
            description: option.description,
          });
        }
      }
    }
  }

  // Helper method to find an option by name or alias
  private findOption(command: Command, optionName: string): Option | undefined {
    // Try direct match (with dashes)
    let option = command.options.get(optionName);
    if (option) return option;

    // Try without dashes (the actual storage format)
    option = command.options.get(optionName.replace(/^-+/, ''));
    if (option) return option;

    // Try by short alias
    for (const [name, opt] of command.options) {
      if (opt.alias && `-${opt.alias}` === optionName) {
        return opt;
      }
    }

    return undefined;
  }

  // Handle command completion
  private handleCommandCompletion(previousArgs: string[], toComplete: string) {
    const commandParts = this.stripOptions(previousArgs);

    for (const [k, command] of this.commands) {
      if (k === '') continue;

      const parts = k.split(' ');
      const match = parts
        .slice(0, commandParts.length)
        .every((part, i) => part === commandParts[i]);

      if (match && parts[commandParts.length]?.startsWith(toComplete)) {
        this.completions.push({
          value: parts[commandParts.length],
          description: command.description,
        });
      }
    }
  }

  // Handle positional argument completion
  private handlePositionalCompletion(
    command: Command,
    previousArgs: string[],
    toComplete: string,
    endsWithSpace: boolean
  ) {
    // Get the current argument position (subtract command name)
    const commandParts = command.value.split(' ').length;
    const currentArgIndex = Math.max(0, previousArgs.length - commandParts);
    const argumentEntries = Array.from(command.arguments.entries());

    // If we have arguments defined
    if (argumentEntries.length > 0) {
      // Find the appropriate argument for the current position
      let targetArgument: Argument | undefined;

      if (currentArgIndex < argumentEntries.length) {
        // We're within the defined arguments
        const [argName, argument] = argumentEntries[currentArgIndex];
        targetArgument = argument;
      } else {
        // We're beyond the defined arguments, check if the last argument is variadic
        const lastArgument = argumentEntries[argumentEntries.length - 1][1];
        if (lastArgument.variadic) {
          targetArgument = lastArgument;
        }
      }

      // If we found a target argument with a handler, use it
      if (
        targetArgument &&
        targetArgument.handler &&
        typeof targetArgument.handler === 'function'
      ) {
        const suggestions: Completion[] = [];
        targetArgument.handler.call(
          targetArgument,
          (value: string, description: string) =>
            suggestions.push({ value, description }),
          command.options
        );
        this.completions.push(...suggestions);
      }
    }
  }

  // Format and output completion results
  private complete(toComplete: string) {
    this.directive = ShellCompDirective.ShellCompDirectiveNoFileComp;

    const seen = new Set<string>();
    this.completions
      .filter((comp) => {
        if (seen.has(comp.value)) return false;
        seen.add(comp.value);
        return true;
      })
      .filter((comp) => comp.value.startsWith(toComplete))
      .forEach((comp) =>
        console.log(`${comp.value}\t${comp.description ?? ''}`)
      );
    console.log(`:${this.directive}`);
  }

  parse(args: string[]) {
    this.completions = [];

    const endsWithSpace = args[args.length - 1] === '';

    if (endsWithSpace) {
      args.pop();
    }

    let toComplete = args[args.length - 1] || '';
    const previousArgs = args.slice(0, -1);

    if (endsWithSpace) {
      if (toComplete !== '') {
        previousArgs.push(toComplete);
      }
      toComplete = '';
    }

    const [matchedCommand] = this.matchCommand(previousArgs);
    const lastPrevArg = previousArgs[previousArgs.length - 1];

    // 1. Handle flag/option completion
    if (this.shouldCompleteFlags(lastPrevArg, toComplete, endsWithSpace)) {
      this.handleFlagCompletion(
        matchedCommand,
        previousArgs,
        toComplete,
        endsWithSpace,
        lastPrevArg
      );
    } else {
      // Check if we just finished a boolean option with no value expected
      // In this case, don't complete anything
      if (lastPrevArg?.startsWith('-') && toComplete === '' && endsWithSpace) {
        let option = this.findOption(this, lastPrevArg);
        if (!option) {
          // Check all subcommand options
          for (const [, command] of this.commands) {
            option = this.findOption(command, lastPrevArg);
            if (option) break;
          }
        }

        // If it's a boolean option followed by empty space, don't complete anything
        if (option && option.isBoolean) {
          // Don't add any completions, just output the directive
          this.complete(toComplete);
          return;
        }
      }

      // 2. Handle command/subcommand completion
      if (this.shouldCompleteCommands(toComplete, endsWithSpace)) {
        this.handleCommandCompletion(previousArgs, toComplete);
      }
      // 3. Handle positional arguments - always check for root command arguments
      if (matchedCommand && matchedCommand.arguments.size > 0) {
        this.handlePositionalCompletion(
          matchedCommand,
          previousArgs,
          toComplete,
          endsWithSpace
        );
      }
    }

    this.complete(toComplete);
  }

  setup(name: string, executable: string, shell: string) {
    assert(
      shell === 'zsh' ||
        shell === 'bash' ||
        shell === 'fish' ||
        shell === 'powershell',
      'Unsupported shell'
    );

    switch (shell) {
      case 'zsh': {
        const script = zsh.generate(name, executable);
        console.log(script);
        break;
      }
      case 'bash': {
        const script = bash.generate(name, executable);
        console.log(script);
        break;
      }
      case 'fish': {
        const script = fish.generate(name, executable);
        console.log(script);
        break;
      }
      case 'powershell': {
        const script = powershell.generate(name, executable);
        console.log(script);
        break;
      }
    }
  }
}

const t = new RootCommand();

export default t;
