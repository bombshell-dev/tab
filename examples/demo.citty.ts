import { defineCommand, createMain } from 'citty';
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
  subCommands: {
    dev: defineCommand({
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
    }),
    build: defineCommand({
      meta: {
        name: 'build',
        description: 'Build project',
      },
      run: () => {},
    }),
    lint: defineCommand({
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
    }),
  },
  run: () => {},
});

const completion = await tab(main);

for (const command of completion.commands.values()) {
  if (command.name === 'lint') {
    command.handler = () => {
      return [
        { value: 'main.ts', description: 'Main file' },
        { value: 'index.ts', description: 'Index file' },
      ];
    };
  }

  for (const [o, config] of command.options.entries()) {
    if (o === '--port') {
      config.handler = () => {
        return [
          { value: '3000', description: 'Development server port' },
          { value: '8080', description: 'Alternative port' },
        ];
      };
    }
    if (o === '--host') {
      config.handler = () => {
        return [
          { value: 'localhost', description: 'Localhost' },
          { value: '0.0.0.0', description: 'All interfaces' },
        ];
      };
    }
    if (o === '--config') {
      config.handler = () => {
        return [
          { value: 'vite.config.ts', description: 'Vite config file' },
          { value: 'vite.config.js', description: 'Vite config file' },
        ];
      };
    }
    if (o === '--mode') {
      config.handler = () => {
        return [
          { value: 'development', description: 'Development mode' },
          { value: 'production', description: 'Production mode' },
        ];
      };
    }
    if (o === '--logLevel') {
      config.handler = () => {
        return [
          { value: 'info', description: 'Info level' },
          { value: 'warn', description: 'Warn level' },
          { value: 'error', description: 'Error level' },
          { value: 'silent', description: 'Silent level' },
        ];
      };
    }
  }
}

// Create the CLI and run it
const cli = createMain(main);
cli();
