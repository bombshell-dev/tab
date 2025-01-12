import { defineCommand, createMain, CommandDef, CommandMeta, ArgDef, PositionalArgDef } from "citty";
import tab from "./src/citty";

const main = defineCommand({
    meta: {
        name: "vite",
        description: "Vite CLI tool",
    },
    args: {
        config: { type: "string", description: "Use specified config file", alias: "c" },
        mode: { type: "string", description: "Set env mode", alias: "m" },
        logLevel: { type: "string", description: "info | warn | error | silent", alias: "l" },
    },
    run(ctx) {
    }
});

const devCommand = defineCommand({
    meta: {
        name: "dev",
        description: "Start dev server",
    },
    args: {
        host: { type: "string", description: "Specify hostname" },
        port: { type: "string", description: "Specify port" },
    },
    run({ args }) { },
});

devCommand.subCommands = {
    build: defineCommand({
        meta: {
            name: "build",
            description: "Build project",
        },
        run({ args }) { },
    })
}

main.subCommands = {
    dev: devCommand
} as Record<string, CommandDef<any>>;

const completion = await tab(main)

for (const command of completion.commands.values()) {

    for (const [o, config] of command.options.entries()) {
        if (o === "--port") {
            config.handler = () => {
                return [
                    { value: "3000", description: "Development server port" },
                    { value: "8080", description: "Alternative port" },
                ]
            }
        }
        if (o === "--host") {
            config.handler = () => {
                return [
                    { value: "localhost", description: "Localhost" },
                    { value: "0.0.0.0", description: "All interfaces" },
                ]
            }
        }
        if (o === "--config") {
            config.handler = () => {
                return [
                    { value: "vite.config.ts", description: "Vite config file" },
                    { value: "vite.config.js", description: "Vite config file" },
                ]
            }
        }
        if (o === "--mode") {
            config.handler = () => {
                return [
                    { value: "development", description: "Development mode" },
                    { value: "production", description: "Production mode" },
                ]
            }
        }
        if (o === "--logLevel") {
            config.handler = () => {
                return [
                    { value: "info", description: "Info level" },
                    { value: "warn", description: "Warn level" },
                    { value: "error", description: "Error level" },
                    { value: "silent", description: "Silent level" },
                ]
            }
        }
    }
}

// for (const command of [main as CommandDef<any>, ...Object.values(main.subCommands as Record<string, CommandDef<any>>)]) {
//     const meta = command.meta as CommandMeta;
//     const commandName = meta.name;

//     for (const [argName, argConfig] of Object.entries(command.args || {}) as [string, ArgDef][]) {
//         const optionKey = `--${argName}`;

//         if (argName === "port") {
//             flagMap.set(optionKey, async (_, toComplete) => {
//                 const options = [
//                     { action: "3000", description: "Development server port" },
//                     { action: "8080", description: "Alternative port" },
//                 ];
//                 return toComplete
//                     ? options.filter(comp => comp.action.startsWith(toComplete))
//                     : options;
//             });
//         } else if (argName === "host") {
//             flagMap.set(optionKey, async (_, toComplete) => {
//                 const options = [
//                     { action: "localhost", description: "Localhost" },
//                     { action: "0.0.0.0", description: "All interfaces" },
//                 ];
//                 return toComplete
//                     ? options.filter(comp => comp.action.startsWith(toComplete))
//                     : options;
//             });
//         } else if (argName === "config") {
//             flagMap.set(optionKey, async (_, toComplete) => {
//                 const configFiles = ["vite.config.ts", "vite.config.js"].filter(
//                     (file) => file.startsWith(toComplete)
//                 );
//                 return configFiles.map((file) => ({ action: file }));
//             });
//         } else if (argName === "mode") {
//             flagMap.set(optionKey, async (_, toComplete) => {
//                 const options = [
//                     { action: "development", description: "Development mode" },
//                     { action: "production", description: "Production mode" },
//                 ];
//                 return toComplete
//                     ? options.filter(comp => comp.action.startsWith(toComplete))
//                     : options;
//             });
//         } else {
//             flagMap.set(optionKey, async (_, toComplete) => {
//                 const flag = optionKey.startsWith("--") ? optionKey.slice(2) : optionKey;
//                 if (!toComplete || optionKey.startsWith(toComplete)) {
//                     return [{ action: optionKey, description: argConfig.description }];
//                 }
//                 return [];
//             });
//         }
//     }

//     if (command.args) {
//         const positionals = Object.entries(command.args)
//             .filter(([, config]) => (config as any).type === "positional")
//             .map(([argName, argConfig]) => {
//                 const conf = argConfig as PositionalArgDef;
//                 return {
//                     value: argName,
//                     variadic: false,
//                     required: !!conf.required,
//                     completion: async (_, toComplete) => {
//                         const options = [
//                             { action: "src/", description: "Source directory" },
//                             { action: "./", description: "Current directory" },
//                         ];
//                         return toComplete
//                             ? options.filter(comp => comp.action.startsWith(toComplete))
//                             : options;
//                     },
//                 };
//             });
//         positionalMap.set(commandName!, positionals);
//     }
// }


const cli = createMain(main);

cli();
