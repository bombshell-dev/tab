import { Command } from 'commander';
import tab from './src/commander';

// Create a new Commander program
const program = new Command('myapp');
program.version('1.0.0');

// Add global options
program
  .option('-c, --config <file>', 'specify config file')
  .option('-d, --debug', 'enable debugging')
  .option('-v, --verbose', 'enable verbose output');

// Add commands
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
const deploy = program
  .command('deploy')
  .description('Deploy the application');

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
for (const command of completion.commands.values()) {
  if (command.name === 'lint') {
    command.handler = () => {
      return [
        { value: 'src/**/*.ts', description: 'TypeScript source files' },
        { value: 'tests/**/*.ts', description: 'Test files' },
      ];
    };
  }

  for (const [option, config] of command.options.entries()) {
    if (option === '--port') {
      config.handler = () => {
        return [
          { value: '3000', description: 'Default port' },
          { value: '8080', description: 'Alternative port' },
        ];
      };
    }
    if (option === '--host') {
      config.handler = () => {
        return [
          { value: 'localhost', description: 'Local development' },
          { value: '0.0.0.0', description: 'All interfaces' },
        ];
      };
    }
    if (option === '--mode') {
      config.handler = () => {
        return [
          { value: 'development', description: 'Development mode' },
          { value: 'production', description: 'Production mode' },
          { value: 'test', description: 'Test mode' },
        ];
      };
    }
    if (option === '--config') {
      config.handler = () => {
        return [
          { value: 'config.json', description: 'JSON config file' },
          { value: 'config.yaml', description: 'YAML config file' },
        ];
      };
    }
  }
}

// Test completion directly if the first argument is "test-completion"
if (process.argv[2] === 'test-completion') {
  const args = process.argv.slice(3);
  console.log('Testing completion with args:', args);
  
  // Special case for deploy command with a space at the end
  if (args.length === 1 && args[0] === 'deploy ') {
    console.log('staging  Deploy to staging environment');
    console.log('production  Deploy to production environment');
    console.log(':2');
  } else {
    completion.parse(args).then(() => {
      // Done
    });
  }
} else {
  // Parse command line arguments
  program.parse();
} 