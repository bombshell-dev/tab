import { Command, Option } from 'commander';
import tab from '../src/commander';

// Create a new Commander program
const program = new Command('myapp');
program.version('1.0.0');

// Add global options
program
  .option('-c, --config <file>', 'Use specified config file')
  .option('-m, --mode <mode>', 'Set env mode')
  .addOption(
    new Option('-l, --logLevel <level>', 'Specify log level').choices([
      'info',
      'warn',
      'error',
      'silent',
    ])
  );

// Add commands
const devCommand = program
  .command('dev')
  .description('Start dev server')
  .option('-H, --host [host]', `Specify hostname`)
  .option('-p, --port <port>', `Specify port`)
  .option('-v, --verbose', `Enable verbose logging`)
  .option('--quiet', `Suppress output`)
  .action((options) => {});
// subcommands of dev
devCommand
  .command('start')
  .description('Start development server')
  .action((options) => {});
devCommand
  .command('build')
  .description('Build project')
  .action((options) => {});

program
  .command('serve')
  .description('Start the server')
  .option('-p, --port <number>', 'port to use', '3000')
  .option('-H, --host <host>', 'host to use', 'localhost')
  .action((options) => {
    console.log('Starting server...');
  });

program
  .command('build')
  .description('Build the project')
  .option('-m, --mode <mode>', 'build mode', 'production')
  .option('--no-minify', 'disable minification')
  .action((options) => {
    console.log('Building project...');
  });

// Command with subcommands
const deploy = program.command('deploy').description('Deploy the application');

deploy
  .command('staging')
  .description('Deploy to staging environment')
  .action(() => {
    console.log('Deploying to staging...');
  });

deploy
  .command('production')
  .description('Deploy to production environment')
  .action(() => {
    console.log('Deploying to production...');
  });

// Command with positional arguments
program
  .command('lint [files...]')
  .description('Lint source files')
  .option('--fix', 'automatically fix problems')
  .action((files, options) => {
    console.log('Linting files...');
  });

// Initialize tab completion
const completion = tab(program);

// Configure custom completions
// Options on root command
const configOption = completion.options.get('config');
if (configOption) {
  configOption.handler = (complete) => {
    complete('vite.config.ts', 'Vite config file');
    complete('vite.config.js', 'Vite config file');
  };
}
const modeOption = completion.options.get('mode');
if (modeOption) {
  modeOption.handler = (complete) => {
    complete('development', 'Development mode');
    complete('production', 'Production mode');
  };
}
const logLevelOption = completion.options.get('logLevel');
if (logLevelOption) {
  logLevelOption.handler = (complete) => {
    complete('info', 'Info level');
    complete('warn', 'Warn level');
    complete('error', 'Error level');
    complete('silent', 'Silent level');
  };
}

// Options on dev command
const devCommandInstance = completion.commands.get('dev');
if (devCommandInstance) {
  const portOption = devCommandInstance.options.get('port');
  if (portOption) {
    portOption.handler = (complete) => {
      complete('3000', 'Development server port');
      complete('8080', 'Alternative port');
    };
  }
  const hostOption = devCommandInstance.options.get('host');
  if (hostOption) {
    hostOption.handler = (complete) => {
      complete('localhost', 'Localhost');
      complete('127.0.0.1', 'Localhost IP');
    };
  }
}

// Parse command line arguments
program.parse();
