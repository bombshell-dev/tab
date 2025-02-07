import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';

// ShellCompRequestCmd is the name of the hidden command that is used to request
// completion results from the program. It is used by the shell completion scripts.
export const ShellCompRequestCmd: string = '__complete';

// ShellCompNoDescRequestCmd is the name of the hidden command that is used to request
// completion results without their description. It is used by the shell completion scripts.
export const ShellCompNoDescRequestCmd: string = '__completeNoDesc';

// ShellCompDirective is a bit map representing the different behaviors the shell
// can be instructed to have once completions have been provided.
export const ShellCompDirective = {
  // ShellCompDirectiveError indicates an error occurred and completions should be ignored.
  ShellCompDirectiveError: 1 << 0,

  // ShellCompDirectiveNoSpace indicates that the shell should not add a space
  // after the completion even if there is a single completion provided.
  ShellCompDirectiveNoSpace: 1 << 1,

  // ShellCompDirectiveNoFileComp indicates that the shell should not provide
  // file completion even when no completion is provided.
  ShellCompDirectiveNoFileComp: 1 << 2,

  // ShellCompDirectiveFilterFileExt indicates that the provided completions
  // should be used as file extension filters.
  // For flags, using Command.MarkFlagFilename() and Command.MarkPersistentFlagFilename()
  // is a shortcut to using this directive explicitly.  The BashCompFilenameExt
  // annotation can also be used to obtain the same behavior for flags.
  ShellCompDirectiveFilterFileExt: 1 << 3,

  // ShellCompDirectiveFilterDirs indicates that only directory names should
  // be provided in file completion.  To request directory names within another
  // directory, the returned completions should specify the directory within
  // which to search.  The BashCompSubdirsInDir annotation can be used to
  // obtain the same behavior but only for flags.
  ShellCompDirectiveFilterDirs: 1 << 4,

  // ShellCompDirectiveKeepOrder indicates that the shell should preserve the order
  // in which the completions are provided.
  ShellCompDirectiveKeepOrder: 1 << 5,

  // ===========================================================================

  // All directives using iota (or equivalent in Go) should be above this one.
  // For internal use.
  shellCompDirectiveMaxValue: 1 << 6,

  // ShellCompDirectiveDefault indicates to let the shell perform its default
  // behavior after completions have been provided.
  // This one must be last to avoid messing up the iota count.
  ShellCompDirectiveDefault: 0,
};

export type Positional = {
  required: boolean;
  variadic: boolean;
  completion: Handler;
};

type Item = {
  description: string;
  value: string;
};

type Handler = (
  previousArgs: string[],
  toComplete: string,
  endsWithSpace: boolean
) => Item[] | Promise<Item[]>;

type Option = {
  description: string;
  handler: Handler;
};

type Command = {
  name: string;
  description: string;
  args: boolean[];
  handler: Handler;
  options: Map<string, Option>;
  parent?: Command;
};

export class Completion {
  commands = new Map<string, Command>();
  completions: Item[] = [];
  directive = ShellCompDirective.ShellCompDirectiveDefault;

  // vite <entry> <another> [...files]
  // args: [false, false, true], only the last argument can be variadic
  addCommand(
    name: string,
    description: string,
    args: boolean[],
    handler: Handler,
    parent?: string
  ) {
    const key = parent ? `${parent} ${name}` : name;
    this.commands.set(key, {
      name: key,
      description,
      args,
      handler,
      options: new Map(),
      parent: parent ? this.commands.get(parent)! : undefined,
    });
    return key;
  }

  // --port
  addOption(
    command: string,
    option: string,
    description: string,
    handler: Handler
  ) {
    const cmd = this.commands.get(command);
    if (!cmd) {
      throw new Error(`Command ${command} not found.`);
    }
    cmd.options.set(option, { description, handler });
    return option;
  }

  // TODO: this should be aware of boolean args and stuff
  private stripOptions(args: string[]): string[] {
    const parts: string[] = [];
    let option = false;
    for (const k of args) {
      if (k.startsWith('-')) {
        option = true;
        continue;
      }
      if (option) {
        option = false;
        continue;
      }
      parts.push(k);
    }
    return parts;
  }

  private matchCommand(args: string[]): [Command, string[]] {
    args = this.stripOptions(args);
    let parts: string[] = [];
    let remaining: string[] = [];
    let matched: Command = this.commands.get('')!;
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

  async parse(args: string[]) {
    const endsWithSpace = args[args.length - 1] === '';

    if (endsWithSpace) {
      args.pop();
    }

    let toComplete = args[args.length - 1] || '';
    const previousArgs = args.slice(0, -1);

    if (endsWithSpace) {
      previousArgs.push(toComplete);
      toComplete = '';
    }

    const [matchedCommand, remaining] = this.matchCommand(previousArgs);

    const lastPrevArg = previousArgs[previousArgs.length - 1];

    // 1. Handle flag/option completion
    if (this.shouldCompleteFlags(lastPrevArg, toComplete, endsWithSpace)) {
      await this.handleFlagCompletion(
        matchedCommand,
        previousArgs,
        toComplete,
        endsWithSpace,
        lastPrevArg
      );
    } else {
      // 2. Handle command/subcommand completion
      if (this.shouldCompleteCommands(toComplete, endsWithSpace)) {
        await this.handleCommandCompletion(previousArgs, toComplete);
      }
      // 3. Handle positional arguments
      if (matchedCommand && matchedCommand.args.length > 0) {
        await this.handlePositionalCompletion(
          matchedCommand,
          previousArgs,
          toComplete,
          endsWithSpace
        );
      }
    }
    this.complete(toComplete);
  }

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

  private shouldCompleteFlags(
    lastPrevArg: string | undefined,
    toComplete: string,
    endsWithSpace: boolean
  ): boolean {
    return lastPrevArg?.startsWith('--') || toComplete.startsWith('--');
  }

  private shouldCompleteCommands(
    toComplete: string,
    endsWithSpace: boolean
  ): boolean {
    return !toComplete.startsWith('-');
  }

  private async handleFlagCompletion(
    command: Command,
    previousArgs: string[],
    toComplete: string,
    endsWithSpace: boolean,
    lastPrevArg: string | undefined
  ) {
    // Handle flag value completion
    let flagName: string | undefined;
    let valueToComplete = toComplete;

    if (toComplete.includes('=')) {
      // Handle --flag=value case
      const parts = toComplete.split('=');
      flagName = parts[0];
      valueToComplete = parts[1] || '';
    } else if (lastPrevArg?.startsWith('--')) {
      // Handle --flag value case
      flagName = lastPrevArg;
    }

    if (flagName) {
      const option = command.options.get(flagName);
      if (option) {
        const suggestions = await option.handler(
          previousArgs,
          valueToComplete,
          endsWithSpace
        );
        if (toComplete.includes('=')) {
          // Reconstruct the full flag=value format
          this.completions = suggestions.map((suggestion) => ({
            value: `${flagName}=${suggestion.value}`,
            description: suggestion.description,
          }));
        } else {
          this.completions.push(...suggestions);
        }
      }
      return;
    }

    // Handle flag name completion
    if (toComplete.startsWith('--')) {
      for (const [name, option] of command.options) {
        if (name.startsWith(toComplete)) {
          this.completions.push({
            value: name,
            description: option.description,
          });
        }
      }
    }
  }

  private async handleCommandCompletion(
    previousArgs: string[],
    toComplete: string
  ) {
    const commandParts = [...previousArgs];

    for (const k of this.commands.keys()) {
      if (k === '') continue;
      const parts = k.split(' ');
      let match = true;

      let i = 0;
      while (i < commandParts.length) {
        if (parts[i] !== commandParts[i]) {
          match = false;
          break;
        }
        i++;
      }
      if (match && parts[i]?.startsWith(toComplete)) {
        this.completions.push({
          value: parts[i],
          description: this.commands.get(k)!.description,
        });
      }
    }
  }

  private async handlePositionalCompletion(
    command: Command,
    previousArgs: string[],
    toComplete: string,
    endsWithSpace: boolean
  ) {
    const suggestions = await command.handler(
      previousArgs,
      toComplete,
      endsWithSpace
    );
    this.completions.push(...suggestions);
  }
}

export function script(
  shell: 'zsh' | 'bash' | 'fish' | 'powershell',
  name: string,
  x: string
) {
  switch (shell) {
    case 'zsh': {
      const script = zsh.generate(name, x);
      console.log(script);
      break;
    }
    case 'bash': {
      const script = bash.generate(name, x);
      console.log(script);
      break;
    }
    case 'fish': {
      const script = fish.generate(name, x);
      console.log(script);
      break;
    }
    case 'powershell': {
      const script = powershell.generate(name, x);
      console.log(script);
      break;
    }
    default: {
      throw new Error(`Unsupported shell: ${shell}`);
    }
  }
}
