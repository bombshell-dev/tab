import { ArgDef, defineCommand } from 'citty';
import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import type {
  ArgsDef,
  CommandDef,
  PositionalArgDef,
  SubCommandsDef,
} from 'citty';
import { generateFigSpec } from './fig';
import { CompletionConfig, assertDoubleDashes } from './shared';
import { OptionHandler, Command, Option, OptionsMap, noopHandler } from './t';
import t from './t';

function quoteIfNeeded(path: string) {
  return path.includes(' ') ? `'${path}'` : path;
}

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);
const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

function isConfigPositional<T extends ArgsDef>(config: CommandDef<T>) {
  return (
    config.args &&
    Object.values(config.args).some((arg) => arg.type === 'positional')
  );
}

// Convert Handler from index.ts to OptionHandler from t.ts
function convertOptionHandler(handler: any): OptionHandler {
  return function (
    this: Option,
    complete: (value: string, description: string) => void,
    options: OptionsMap,
    previousArgs?: string[],
    toComplete?: string,
    endsWithSpace?: boolean
  ) {
    // For short flags with equals sign and a value, don't complete (citty behavior)
    // Check if this is a short flag option and if the toComplete looks like a value
    if (
      this.alias &&
      toComplete &&
      toComplete !== '' &&
      !toComplete.startsWith('-')
    ) {
      // This might be a short flag with equals sign and a value
      // Check if the previous args contain a short flag with equals sign
      if (previousArgs && previousArgs.length > 0) {
        const lastArg = previousArgs[previousArgs.length - 1];
        if (lastArg.includes('=')) {
          const [flag, value] = lastArg.split('=');
          if (flag.startsWith('-') && !flag.startsWith('--') && value !== '') {
            return; // Don't complete short flags with equals sign and value
          }
        }
      }
    }

    // Call the old handler with the proper context
    const result = handler(
      previousArgs || [],
      toComplete || '',
      endsWithSpace || false
    );

    if (Array.isArray(result)) {
      result.forEach((item: any) =>
        complete(item.value, item.description || '')
      );
    } else if (result && typeof result.then === 'function') {
      // Handle async handlers
      result.then((items: any[]) => {
        items.forEach((item: any) =>
          complete(item.value, item.description || '')
        );
      });
    }
  };
}

async function handleSubCommands(
  subCommands: SubCommandsDef,
  parentCmd?: string,
  completionConfig?: Record<string, CompletionConfig>
) {
  for (const [cmd, resolvableConfig] of Object.entries(subCommands)) {
    const config = await resolve(resolvableConfig);
    const meta = await resolve(config.meta);
    const subCommands = await resolve(config.subCommands);
    const subCompletionConfig = completionConfig?.[cmd];

    if (!meta || typeof meta?.description !== 'string') {
      throw new Error('Invalid meta or missing description.');
    }
    const isPositional = isConfigPositional(config);

    // Add command using t.ts API
    const commandName = parentCmd ? `${parentCmd} ${cmd}` : cmd;
    const command = t.command(commandName, meta.description);

    // Set args for the command if it has positional arguments
    if (isPositional && config.args) {
      // Add arguments with completion handlers from subCompletionConfig args
      for (const [argName, argConfig] of Object.entries(config.args)) {
        const conf = argConfig as ArgDef;
        if (conf.type === 'positional') {
          // Check if this is a variadic argument (required: false for variadic in citty)
          const isVariadic = conf.required === false;
          const argHandler = subCompletionConfig?.args?.[argName];
          if (argHandler) {
            command.argument(argName, argHandler, isVariadic);
          } else {
            command.argument(argName, undefined, isVariadic);
          }
        }
      }
    }

    // Handle nested subcommands recursively
    if (subCommands) {
      await handleSubCommands(
        subCommands,
        commandName,
        subCompletionConfig?.subCommands
      );
    }

    // Handle arguments
    if (config.args) {
      for (const [argName, argConfig] of Object.entries(config.args)) {
        const conf = argConfig as ArgDef;
        // Extract alias from the config if it exists
        const shortFlag =
          typeof conf === 'object' && 'alias' in conf
            ? Array.isArray(conf.alias)
              ? conf.alias[0]
              : conf.alias
            : undefined;

        // Detect boolean options and use appropriate handler
        const isBoolean = conf.type === 'boolean';
        const customHandler = subCompletionConfig?.options?.[argName];
        const handler = isBoolean ? noopHandler : customHandler;

        // Add option using t.ts API - auto-detection handles boolean vs value options
        if (shortFlag) {
          if (handler) {
            command.option(argName, conf.description ?? '', handler, shortFlag);
          } else {
            command.option(argName, conf.description ?? '', shortFlag);
          }
        } else {
          if (handler) {
            command.option(argName, conf.description ?? '', handler);
          } else {
            command.option(argName, conf.description ?? '');
          }
        }
      }
    }
  }
}

export default async function tab<TArgs extends ArgsDef>(
  instance: CommandDef<TArgs>,
  completionConfig?: CompletionConfig
): Promise<any> {
  const meta = await resolve(instance.meta);

  if (!meta) {
    throw new Error('Invalid meta.');
  }
  const name = meta.name;
  if (!name) {
    throw new Error('Invalid meta or missing name.');
  }

  const subCommands = await resolve(instance.subCommands);
  if (!subCommands) {
    throw new Error('Invalid or missing subCommands.');
  }

  const isPositional = isConfigPositional(instance);

  // Set args for the root command if it has positional arguments
  if (isPositional && instance.args) {
    for (const [argName, argConfig] of Object.entries(instance.args)) {
      const conf = argConfig as PositionalArgDef;
      if (conf.type === 'positional') {
        const isVariadic = conf.required === false;
        const argHandler = completionConfig?.args?.[argName];
        if (argHandler) {
          t.argument(argName, argHandler, isVariadic);
        } else {
          t.argument(argName, undefined, isVariadic);
        }
      }
    }
  }

  await handleSubCommands(
    subCommands,
    undefined,
    completionConfig?.subCommands
  );

  if (instance.args) {
    for (const [argName, argConfig] of Object.entries(instance.args)) {
      const conf = argConfig as ArgDef;

      // Detect boolean options and use appropriate handler
      const isBoolean = conf.type === 'boolean';
      const customHandler = completionConfig?.options?.[argName];
      const handler = isBoolean ? noopHandler : customHandler;

      // Add option using t.ts API - auto-detection handles boolean vs value options
      if (handler) {
        t.option(argName, conf.description ?? '', handler);
      } else {
        t.option(argName, conf.description ?? '');
      }
    }
  }

  const completeCommand = defineCommand({
    meta: {
      name: 'complete',
      description: 'Generate shell completion scripts',
    },
    args: {
      shell: {
        type: 'positional',
        description: 'Shell type (zsh, bash, fish, powershell, fig)',
        required: false,
      },
    },
    async run(ctx) {
      let shell: string | undefined = ctx.rawArgs[0];

      if (shell === '--') {
        shell = undefined;
      }

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
        case 'fig': {
          const spec = await generateFigSpec(instance);
          console.log(spec);
          break;
        }
        default: {
          assertDoubleDashes(name);

          const extra = ctx.rawArgs.slice(ctx.rawArgs.indexOf('--') + 1);
          // Use t.ts parse method instead of completion.parse
          return t.parse(extra);
        }
      }
    },
  });

  subCommands.complete = completeCommand;

  return t;
}

type Resolvable<T> = T | Promise<T> | (() => T) | (() => Promise<T>);

async function resolve<T>(resolvable: Resolvable<T>): Promise<T> {
  return resolvable instanceof Function ? await resolvable() : await resolvable;
}
