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
import t, { RootCommand } from './t';

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

        // Add option using t.ts API - store without -- prefix
        const handler = subCompletionConfig?.options?.[argName];
        if (handler) {
          // Has custom handler → value option
          if (shortFlag) {
            command.option(argName, conf.description ?? '', handler, shortFlag);
          } else {
            command.option(argName, conf.description ?? '', handler);
          }
        } else {
          // No custom handler → boolean flag
          if (shortFlag) {
            command.option(argName, conf.description ?? '', shortFlag);
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
): Promise<RootCommand> {
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

      // Extract alias (same logic as subcommands)
      const shortFlag =
        typeof conf === 'object' && 'alias' in conf
          ? Array.isArray(conf.alias)
            ? conf.alias[0]
            : conf.alias
          : undefined;

      // Add option using t.ts API - store without -- prefix
      const handler = completionConfig?.options?.[argName];
      if (handler) {
        // Has custom handler → value option
        if (shortFlag) {
          t.option(argName, conf.description ?? '', handler, shortFlag);
        } else {
          t.option(argName, conf.description ?? '', handler);
        }
      } else {
        // No custom handler → boolean flag
        if (shortFlag) {
          t.option(argName, conf.description ?? '', shortFlag);
        } else {
          t.option(argName, conf.description ?? '');
        }
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
