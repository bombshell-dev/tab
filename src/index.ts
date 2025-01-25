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
  args: boolean[]
  handler: Handler;
  options: Map<string, Option>;
  parent?: Command;
};

export class Completion {
  commands = new Map<string, Command>();

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

  async parse(args: string[], potentialCommand: string) {
    const matchedCommand =
      this.commands.get(potentialCommand) ?? this.commands.get('')!;
    let directive = ShellCompDirective.ShellCompDirectiveDefault;
    const completions: Item[] = [];

    const endsWithSpace = args[args.length - 1] === '';
    if (endsWithSpace) {
      args.pop();
    }

    let toComplete = args[args.length - 1] || '';
    const previousArgs = args.slice(0, -1);

    const lastPrevArg = previousArgs[previousArgs.length - 1];
    if (lastPrevArg?.startsWith('--') && !endsWithSpace) {
      const { handler } = matchedCommand.options.get(lastPrevArg)!;
      if (handler) {
          const flagSuggestions = await handler(
            previousArgs,
            toComplete,
            endsWithSpace
          );
          completions.push(
            ...flagSuggestions.filter((comp) =>
              comp.value.startsWith(toComplete)
            )
          );
          directive = ShellCompDirective.ShellCompDirectiveNoFileComp;
        }
    } else if (toComplete.startsWith('--')) {
      directive = ShellCompDirective.ShellCompDirectiveNoFileComp;
      const equalsIndex = toComplete.indexOf('=');

      if (equalsIndex !== -1) {
        const flagName = toComplete.slice(2, equalsIndex);
        const valueToComplete = toComplete.slice(equalsIndex + 1);
        const { handler } = matchedCommand.options.get(`--${flagName}`)!;

        if (handler) {
          const suggestions = await handler(
            previousArgs,
            valueToComplete,
            endsWithSpace
          );
          completions.push(...suggestions);
        }
      } else if (!endsWithSpace) {
        const options = new Map(matchedCommand.options);

        let currentCommand = matchedCommand;
        while (currentCommand.parent) {
          for (const [key, value] of currentCommand.parent.options) {
            if (!options.has(key)) {
              options.set(key, value);
            }
          }
          currentCommand = currentCommand.parent;
        }

        const specifiedFlags = previousArgs
          .filter((arg) => arg.startsWith('-'))
          .filter((arg) => arg.startsWith('--'));
        const availableFlags = [...options.keys()]
          .filter((flag) => !specifiedFlags.includes(flag))
          .filter((flag) => flag.startsWith(toComplete));

        completions.push(
          ...availableFlags.map((flag) => ({
            value: flag,
            description: options.get(flag)!.description ?? '',
          }))
        );
      } else {
        const { handler } = matchedCommand.options.get(toComplete)!;

        if (handler) {
          const suggestions = await handler(
            previousArgs,
            toComplete,
            endsWithSpace
          );
          completions.push(...suggestions);
        }
      }
    } else {
      const potentialCommandParts = potentialCommand.split(' ');
      console.log(potentialCommandParts)
      for (const [k, v] of this.commands) {
        // if the command is root, skip it
        if (k === '') {
          continue;
        }

        const parts = [...k.split(' '), ...v.args];
        console.log(parts)
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const potentialPart = potentialCommandParts[i] || '';

          // Skip if we've already added this suggestion
          const alreadyExists =
            completions.findIndex((item) => item.value === part) !== -1;
          if (alreadyExists) {
            break;
          }

          async function callHandler() {
            console.log(matchedCommand)
            console.log('callHandler', previousArgs, toComplete, endsWithSpace)
            completions.push(...await matchedCommand.handler?.(
              previousArgs,
              toComplete,
              endsWithSpace
            ))
          }

          // If we're at the current word being completed
          if (i === potentialCommandParts.length - 1) {
            if (endsWithSpace) {
              const nextPart = parts[i + 1]
              if (typeof nextPart === 'boolean') {
                await callHandler()
              }
            } else {
              // Only add if it matches the current partial input
              console.log('part', part, potentialPart)
              if (typeof part === 'boolean') {
                await callHandler()
              } else if (part.startsWith(potentialPart)) {
                completions.push({ value: part, description: v.description });
              }
            }
            break;
          } else if (i === parts.length - 1 && part === true) { // variadic
            await callHandler()
          }

          // For previous parts, they must match exactly
          if (part !== potentialPart) {
            break;
          }
        }
      }

      directive = ShellCompDirective.ShellCompDirectiveNoFileComp;
    }
    // vite [...items]
    // vite dev
    // vite lint [item]
    // vite dev build

    // TODO: prettier (plus check in ci)
    // TODO: ci type check

    // TODO: positionals (tomorrow night), this is nearly there!

    // TODO: cac (tomorrow night)
    // TODO: check behaviour of the tests (tomorrow night)

    completions.forEach((comp) =>
      console.log(`${comp.value}\t${comp.description ?? ''}`)
    );
    console.log(`:${directive}`);
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
