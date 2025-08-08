import cac from 'cac';
import tab from '../src/cac';
import type { Option, OptionsMap } from '../src/t';

const cli = cac('vite');

cli
  .option('-c, --config <file>', `Use specified config file`)
  .option('-m, --mode <mode>', `Set env mode`)
  .option('-l, --logLevel <level>', `info | warn | error | silent`);

cli
  .command('dev', 'Start dev server')
  .option('-H, --host [host]', `Specify hostname`)
  .option('-p, --port <port>', `Specify port`)
  .option('-v, --verbose', `Enable verbose logging`)
  .option('--quiet', `Suppress output`)
  .action((options) => {});

cli
  .command('serve', 'Start the server')
  .option('-H, --host [host]', `Specify hostname`)
  .option('-p, --port <port>', `Specify port`)
  .action((options) => {});

cli.command('dev build', 'Build project').action((options) => {});

cli.command('dev start', 'Start development server').action((options) => {});

cli
  .command('copy <source> <destination>', 'Copy files')
  .action((source, destination, options) => {});

cli.command('lint [...files]', 'Lint project').action((files, options) => {});

// Note: With the new t.ts API, handlers are configured through the completionConfig parameter
// rather than by modifying the returned completion object directly
await tab(cli, {
  subCommands: {
    copy: {
      args: {
        source: function (complete) {
          complete('src/', 'Source directory');
          complete('dist/', 'Distribution directory');
          complete('public/', 'Public assets');
        },
        destination: function (complete) {
          complete('build/', 'Build output');
          complete('release/', 'Release directory');
          complete('backup/', 'Backup location');
        },
      },
    },
    lint: {
      args: {
        files: function (complete) {
          complete('main.ts', 'Main file');
          complete('index.ts', 'Index file');
        },
      },
    },
    dev: {
      options: {
        port: function (
          this: Option,
          complete: (value: string, description: string) => void,
          options: OptionsMap
        ) {
          complete('3000', 'Development server port');
          complete('8080', 'Alternative port');
        },
        host: function (
          this: Option,
          complete: (value: string, description: string) => void,
          options: OptionsMap
        ) {
          complete('localhost', 'Localhost');
          complete('0.0.0.0', 'All interfaces');
        },
      },
    },
  },
  options: {
    config: function (
      this: Option,
      complete: (value: string, description: string) => void,
      options: OptionsMap
    ) {
      complete('vite.config.ts', 'Vite config file');
      complete('vite.config.js', 'Vite config file');
    },
    mode: function (
      this: Option,
      complete: (value: string, description: string) => void,
      options: OptionsMap
    ) {
      complete('development', 'Development mode');
      complete('production', 'Production mode');
    },
    logLevel: function (
      this: Option,
      complete: (value: string, description: string) => void,
      options: OptionsMap
    ) {
      complete('info', 'Info level');
      complete('warn', 'Warn level');
      complete('error', 'Error level');
      complete('silent', 'Silent level');
    },
  },
});

cli.parse();
