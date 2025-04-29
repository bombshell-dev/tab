#!/usr/bin/env node

const cac = require('cac');
const cli = cac('demo-cli-cac');

// Define version and help
cli.version('1.0.0');
cli.help();

// Global options
cli.option('-c, --config <file>', 'Specify config file');
cli.option('-d, --debug', 'Enable debugging');

// Start command
cli
  .command('start', 'Start the application')
  .option('-p, --port <port>', 'Port to use', { default: '3000' })
  .action((options) => {
    console.log('Starting application...');
    console.log('Options:', options);
  });

// Build command
cli
  .command('build', 'Build the application')
  .option('-m, --mode <mode>', 'Build mode', { default: 'production' })
  .action((options) => {
    console.log('Building application...');
    console.log('Options:', options);
  });

// Manual implementation of completion for CAC
if (process.argv[2] === '__complete') {
  const args = process.argv.slice(3);
  const toComplete = args[args.length - 1] || '';
  const previousArgs = args.slice(0, -1);

  // Root command completion
  if (previousArgs.length === 0) {
    console.log('start\tStart the application');
    console.log('build\tBuild the application');
    console.log('--help\tDisplay help');
    console.log('--version\tOutput the version number');
    console.log('-c\tSpecify config file');
    console.log('--config\tSpecify config file');
    console.log('-d\tEnable debugging');
    console.log('--debug\tEnable debugging');
    process.exit(0);
  }

  // Subcommand completion
  if (previousArgs[0] === 'start') {
    console.log('-p\tPort to use');
    console.log('--port\tPort to use');
    console.log('--help\tDisplay help');

    // Port value completion if --port is the last arg
    if (
      previousArgs[previousArgs.length - 1] === '--port' ||
      previousArgs[previousArgs.length - 1] === '-p'
    ) {
      console.log('3000\tDefault port');
      console.log('8080\tAlternative port');
    }
    process.exit(0);
  }

  if (previousArgs[0] === 'build') {
    console.log('-m\tBuild mode');
    console.log('--mode\tBuild mode');
    console.log('--help\tDisplay help');

    // Mode value completion if --mode is the last arg
    if (
      previousArgs[previousArgs.length - 1] === '--mode' ||
      previousArgs[previousArgs.length - 1] === '-m'
    ) {
      console.log('development\tDevelopment mode');
      console.log('production\tProduction mode');
      console.log('test\tTest mode');
    }
    process.exit(0);
  }

  process.exit(0);
} else {
  // Parse CLI args
  cli.parse();
}
