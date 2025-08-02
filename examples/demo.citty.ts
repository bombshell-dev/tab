import { defineCommand, createMain, type CommandDef, type ArgsDef } from 'citty';
import tab from '../src/citty';

const main = defineCommand({
  meta: {
    name: 'vite',
    version: '0.0.0',
    description: 'Vite CLI',
  },
  args: {
    project: {
      type: 'positional',
      description: 'Project name',
      required: true,
    },
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
  run: (_ctx) => {},
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

const copyCommand = defineCommand({
  meta: {
    name: 'copy',
    description: 'Copy files',
  },
  args: {
    source: {
      type: 'positional',
      description: 'Source file or directory',
      required: true,
    },
    destination: {
      type: 'positional',
      description: 'Destination file or directory',
      required: true,
    },
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
  copy: copyCommand,
  lint: lintCommand,
} as Record<string, CommandDef<ArgsDef>>;

const completion = await tab(main, {
  args: {
    project: function(complete) {
      complete('my-app', 'My application');
      complete('my-lib', 'My library');
      complete('my-tool', 'My tool');
    },
  },
  options: {
    config: function(this: any, complete) {
      complete('vite.config.ts', 'Vite config file');
      complete('vite.config.js', 'Vite config file');
    },
    mode: function(this: any, complete) {
      complete('development', 'Development mode');
      complete('production', 'Production mode');
    },
    logLevel: function(this: any, complete) {
      complete('info', 'Info level');
      complete('warn', 'Warn level');
      complete('error', 'Error level');
      complete('silent', 'Silent level');
    },
  },

  subCommands: {
    copy: {
      args: {
        source: function(complete) {
          complete('src/', 'Source directory');
          complete('dist/', 'Distribution directory');
          complete('public/', 'Public assets');
        },
        destination: function(complete) {
          complete('build/', 'Build output');
          complete('release/', 'Release directory');
          complete('backup/', 'Backup location');
        },
      },
    },
    lint: {
      args: {
        files: function(complete) {
          complete('main.ts', 'Main file');
          complete('index.ts', 'Index file');
        },
      },
    },
    dev: {
      options: {
        port: function(this: any, complete) {
          complete('3000', 'Development server port');
          complete('8080', 'Alternative port');
        },
        host: function(this: any, complete) {
          complete('localhost', 'Localhost');
          complete('0.0.0.0', 'All interfaces');
        },
      },
    },
  },
});

void completion;

const cli = createMain(main);
cli();
