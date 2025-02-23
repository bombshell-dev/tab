import type { CommandDef, ArgsDef, PositionalArgDef, CommandMeta } from 'citty';

type FigSpec = {
  name: string;
  description: string;
  options?: FigOption[];
  subcommands?: FigSubcommand[];
  args?: FigArg[];
};

type FigOption = {
  name: string;
  description: string;
  args?: FigArg[];
  isRequired?: boolean;
};

type FigSubcommand = {
  name: string;
  description: string;
  options?: FigOption[];
  subcommands?: FigSubcommand[];
  args?: FigArg[];
};

type FigArg = {
  name: string;
  description?: string;
  isOptional?: boolean;
  isVariadic?: boolean;
  suggestions?: FigSuggestion[];
};

type FigSuggestion = {
  name: string;
  description?: string;
};

async function processArgs<T extends ArgsDef>(
  args: T
): Promise<{ options: FigOption[]; args: FigArg[] }> {
  const options: FigOption[] = [];
  const positionalArgs: FigArg[] = [];

  for (const [name, arg] of Object.entries(args)) {
    if (arg.type === 'positional') {
      const positionalArg = arg as PositionalArgDef;
      positionalArgs.push({
        name,
        description: positionalArg.description,
        isOptional: !positionalArg.required,
        // Assume variadic if the name suggests it (e.g. [...files])
        isVariadic: name.startsWith('[...') || name.startsWith('<...'),
      });
    } else {
      const option: FigOption = {
        name: `--${name}`,
        description: arg.description || '',
        isRequired: arg.required,
      };

      if ('alias' in arg && arg.alias) {
        // Handle both string and array aliases
        const aliases = Array.isArray(arg.alias) ? arg.alias : [arg.alias];
        aliases.forEach((alias) => {
          options.push({
            ...option,
            name: `-${alias}`,
          });
        });
      }

      options.push(option);
    }
  }

  return { options, args: positionalArgs };
}

async function processCommand<T extends ArgsDef>(
  command: CommandDef<T>,
  parentName = ''
): Promise<FigSpec> {
  const resolvedMeta = await Promise.resolve(command.meta);
  const meta = resolvedMeta as CommandMeta;
  const subCommands = await Promise.resolve(command.subCommands);

  if (!meta || !meta.name) {
    throw new Error('Command meta or name is missing');
  }

  const spec: FigSpec = {
    name: parentName ? `${parentName} ${meta.name}` : meta.name,
    description: meta.description || '',
  };

  if (command.args) {
    const resolvedArgs = await Promise.resolve(command.args);
    // Cast to ArgsDef since we know the resolved value will be compatible
    const { options, args } = await processArgs(resolvedArgs as ArgsDef);
    if (options.length > 0) spec.options = options;
    if (args.length > 0) spec.args = args;
  }

  if (subCommands) {
    spec.subcommands = await Promise.all(
      Object.entries(subCommands).map(async ([_, subCmd]) => {
        const resolved = await Promise.resolve(subCmd);
        return processCommand(resolved, spec.name);
      })
    );
  }

  return spec;
}

export async function generateFigSpec<T extends ArgsDef>(
  command: CommandDef<T>
): Promise<string> {
  const spec = await processCommand(command);
  return JSON.stringify(spec, null, 2);
}
