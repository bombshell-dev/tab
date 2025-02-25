import { ArgDef, defineCommand } from 'citty';
import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import { Completion, type Handler } from '.';
import type {
  ArgsDef,
  CommandDef,
  PositionalArgDef,
  SubCommandsDef,
} from 'citty';
import { generateFigSpec } from './fig';

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

// TODO (43081j): use type inference some day, so we can type-check
// that the sub commands exist, the options exist, etc.
interface CompletionConfig {
  handler?: Handler;
  subCommands?: Record<string, CompletionConfig>;
  options?: Record<
    string,
    {
      handler: Handler;
    }
  >;
}

const noopHandler: Handler = () => {
  return [];
};

async function handleSubCommands(
  completion: Completion,
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
    const name = completion.addCommand(
      cmd,
      meta.description,
      isPositional ? [false] : [],
      subCompletionConfig?.handler ?? noopHandler,
      parentCmd
    );

    // Handle nested subcommands recursively
    if (subCommands) {
      await handleSubCommands(
        completion,
        subCommands,
        name,
        subCompletionConfig?.subCommands
      );
    }

    // Handle arguments
    if (config.args) {
      for (const [argName, argConfig] of Object.entries(config.args)) {
        const conf = argConfig as ArgDef;
        if (conf.type === 'positional') {
          continue;
        }
        // Extract alias from the config if it exists
        const shortFlag =
          typeof conf === 'object' && 'alias' in conf
            ? Array.isArray(conf.alias)
              ? conf.alias[0]
              : conf.alias
            : undefined;

        completion.addOption(
          name,
          `--${argName}`,
          conf.description ?? '',
          subCompletionConfig?.options?.[argName]?.handler ?? noopHandler,
          shortFlag
        );
      }
    }
  }
}

export default async function tab<TArgs extends ArgsDef>(
  instance: CommandDef<TArgs>,
  completionConfig?: CompletionConfig
) {
  const completion = new Completion();

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

  const root = '';
  const isPositional = isConfigPositional(instance);
  completion.addCommand(
    root,
    meta?.description ?? '',
    isPositional ? [false] : [],
    completionConfig?.handler ?? noopHandler
  );

  await handleSubCommands(
    completion,
    subCommands,
    undefined,
    completionConfig?.subCommands
  );

  if (instance.args) {
    for (const [argName, argConfig] of Object.entries(instance.args)) {
      const conf = argConfig as PositionalArgDef;
      completion.addOption(
        root,
        `--${argName}`,
        conf.description ?? '',
        completionConfig?.options?.[argName]?.handler ?? noopHandler
      );
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
      const extra = ctx.rawArgs.slice(ctx.rawArgs.indexOf('--') + 1);

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
          // const args = (await resolve(instance.args))!;
          // const parsed = parseArgs(extra, args);
          // TODO: this is not ideal at all
          // const matchedCommand = parsed._.join(' ').trim(); //TODO: this was passed to parse line 170
          // TODO: `command lint i` does not work because `lint` and `i` are potential commands
          // instead the potential command should only be `lint`
          // and `i` is the to be completed part
          return completion.parse(extra);
        }
      }
    },
  });

  subCommands.complete = completeCommand;

  return completion;
}

type Resolvable<T> = T | Promise<T> | (() => T) | (() => Promise<T>);

async function resolve<T>(resolvable: Resolvable<T>): Promise<T> {
  return resolvable instanceof Function ? await resolvable() : await resolvable;
}
