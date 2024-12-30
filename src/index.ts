import { flagMap, positionalMap, ShellCompDirective } from "./shared";

export class Completion {
    private commands = new Map<string, any>();

    addCommand(name: string, description: string, handler: Function) {
        this.commands.set(name, { description, handler, options: {} });
    }

    addOption(commandName: string, optionName: string, description: string, handler: Function) {
        const cmd = this.commands.get(commandName);
        if (!cmd) {
            throw new Error(`Command ${commandName} not found.`);
        }
        cmd.options[optionName] = { description, handler };
    }

    async parse(args: string[], mainCommand: any) {
        let directive = ShellCompDirective.ShellCompDirectiveDefault;
        const completions: string[] = [];

        const endsWithSpace = args[args.length - 1] === "";
        if (endsWithSpace) {
            args.pop();
        }

        let toComplete = args[args.length - 1] || "";
        const previousArgs = args.slice(0, -1);

        let matchedCommand = mainCommand;

        if (previousArgs.length > 0) {
            const lastPrevArg = previousArgs[previousArgs.length - 1];
            if (lastPrevArg.startsWith("--")) {
                const flagCompletion = flagMap.get(lastPrevArg);
                if (flagCompletion) {
                    const flagSuggestions = await flagCompletion(previousArgs, toComplete);

                    completions.push(
                        ...flagSuggestions.map(
                            (comp) => `${comp.action}\t${comp.description ?? ""}`
                        )
                    );

                    completions.forEach((comp) => console.log(comp));
                    console.log(`:${directive}`);

                    return;
                }
            }
        }

        if (toComplete.startsWith("--")) {
            if (toComplete === "--") {
                const allFlags = [...flagMap.keys()];
                const specifiedFlags = previousArgs.filter(arg => arg.startsWith("--"));
                const availableFlags = allFlags.filter(flag => !specifiedFlags.includes(flag));

                completions.push(
                    ...availableFlags.map(
                        (flag) =>
                            `${flag}\t${matchedCommand.args[flag.slice(2)]?.description ?? "Option"}`
                    )
                );
            } else {
                const flagNamePartial = toComplete.slice(2);
                const flagKeyPartial = `--${flagNamePartial}`;

                if (flagMap.has(toComplete)) {
                    const flagCompletion = flagMap.get(toComplete);
                    if (flagCompletion) {
                        const flagSuggestions = await flagCompletion(previousArgs, "");
                        completions.push(
                            ...flagSuggestions.map(
                                (comp) => `${comp.action}\t${comp.description ?? ""}`
                            )
                        );
                    }
                } else {
                    const matchingFlags = [...flagMap.keys()].filter((flag) =>
                        flag.startsWith(flagKeyPartial)
                    );

                    completions.push(
                        ...matchingFlags.map(
                            (flag) =>
                                `${flag}\t${matchedCommand.args[flag.slice(2)]?.description ?? "Option"}`
                        )
                    );
                }
            }

            completions.forEach((comp) => console.log(comp));
            console.log(`:${directive}`);
            return;
        }

        // If user typed no flags yet (maybe we’re completing subcommands or positional)
        if (previousArgs.length === 0) {
            completions.push(
                ...Object.keys(mainCommand.subCommands || {})
                    .filter((cmd) => cmd !== "complete")
                    .map(
                        (cmd) =>
                            `${cmd}\t${mainCommand.subCommands[cmd]?.meta.description ?? ""}`
                    )
            );
        } else {
            // complete positional arguments
            const positionalCompletions =
                positionalMap.get(matchedCommand.meta.name) || [];

            for (const positional of positionalCompletions) {
                const suggestions = await positional.completion(previousArgs, toComplete);
                completions.push(
                    ...suggestions.map(
                        (comp) => `${comp.action}\t${comp.description ?? ""}`
                    )
                );
            }
        }

        completions.forEach((comp) => console.log(comp));
        console.log(`:${directive}`);
    }
}
