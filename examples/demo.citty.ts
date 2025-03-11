import { defineCommand, createMain, CommandDef, ArgsDef } from 'citty';
import tab from '../src/citty';

const main = defineCommand({
  meta: {
    name: 'vite',
    version: '0.0.0',
    description: 'Vite CLI',
  },
  args: {
    config: {
      type: 'string',
      description: 'Use specified config file',
      alias: 'c',
    },
    mode: {
      type: 'string',
      description: 'Set env mode',
      alias: 'm',
    },
    logLevel: {
      type: 'string',
      description: 'info | warn | error | silent',
      alias: 'l',
    },
  },
  run: () => {},
});

const devCommand = defineCommand({
  meta: {
    name: 'dev',
    description: 'Start dev server',
  },
  args: {
    host: {
      type: 'string',
      description: 'Specify hostname',
      alias: 'H',
    },
    port: {
      type: 'string',
      description: 'Specify port',
      alias: 'p',
    },
  },
  run: () => {},
});

const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build project',
  },
  run: () => {},
});

const lintCommand = defineCommand({
  meta: {
    name: 'lint',
    description: 'Lint project',
  },
  args: {
    files: {
      type: 'positional',
      description: 'Files to lint',
      required: false,
    },
  },
  run: () => {},
});

main.subCommands = {
  dev: devCommand,
  build: buildCommand,
  lint: lintCommand,
} as Record<string, CommandDef<ArgsDef>>;

// Use the config object approach for completions
const completion = await tab(main, {
  // Root level options
  options: {
    config: {
      handler: () => [
        { value: 'vite.config.ts', description: 'Vite config file' },
        { value: 'vite.config.js', description: 'Vite config file' },
      ]
    },
    mode: {
      handler: () => [
        { value: 'development', description: 'Development mode' },
        { value: 'production', description: 'Production mode' },
      ]
    },
    logLevel: {
      handler: () => [
        { value: 'info', description: 'Info level' },
        { value: 'warn', description: 'Warn level' },
        { value: 'error', description: 'Error level' },
        { value: 'silent', description: 'Silent level' },
      ]
    }
  },
  // Subcommands and their options
  subCommands: {
    lint: {
      handler: () => [
        { value: 'main.ts', description: 'Main file' },
        { value: 'index.ts', description: 'Index file' },
      ]
    },
    dev: {
      options: {
        port: {
          handler: () => [
            { value: '3000', description: 'Development server port' },
            { value: '8080', description: 'Alternative port' },
          ]
        },
        host: {
          handler: () => [
            { value: 'localhost', description: 'Localhost' },
            { value: '0.0.0.0', description: 'All interfaces' },
          ]
        }
      }
    }
  }
});

// Create the CLI and run it
const cli = createMain(main);
cli();
