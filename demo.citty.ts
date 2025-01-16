import { defineCommand, createMain, CommandDef } from "citty";
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
    run(_ctx) {
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
    run(ctx) {
        console.log('dev', ctx)
    },
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

const lintCommand = defineCommand({
    meta: {
        name: "lint",
        description: "Lint project",
    },
    args: {
        files: { type: "positional", description: "Files to lint" },
    },
    run(ctx) {
        console.log('lint', ctx.cmd.args)
    },
});

main.subCommands = {
    dev: devCommand,
    lint: lintCommand

} as Record<string, CommandDef<any>>;

const completion = await tab(main)

for (const command of completion.commands.values()) {
    console.log(command)

    if (command.name === 'lint') {
        console.log('lint')
        command.handler = () => {
            return [
                { value: "main.ts", description: "Main file" },
                { value: "index.ts", description: "Index file" },
            ]
        }
    }

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

const cli = createMain(main);

cli();
