import t, { noopHandler } from '../src/t';

// Global options
t.option(
  'config',
  'Use specified config file',
  function (complete) {
    complete('vite.config.ts', 'Vite config file');
    complete('vite.config.js', 'Vite config file');
  },
  'c'
);

t.option(
  'mode',
  'Set env mode',
  function (complete) {
    complete('development', 'Development mode');
    complete('production', 'Production mode');
  },
  'm'
);

t.option(
  'logLevel',
  'info | warn | error | silent',
  function (complete) {
    complete('info', 'Info level');
    complete('warn', 'Warn level');
    complete('error', 'Error level');
    complete('silent', 'Silent level');
  },
  'l'
);

// Root command argument
t.argument('project', function (complete) {
  complete('my-app', 'My application');
  complete('my-lib', 'My library');
  complete('my-tool', 'My tool');
});

// Dev command
const devCmd = t.command('dev', 'Start dev server');
devCmd.option(
  'host',
  'Specify hostname',
  function (complete) {
    complete('localhost', 'Localhost');
    complete('0.0.0.0', 'All interfaces');
  },
  'H'
);

devCmd.option(
  'port',
  'Specify port',
  function (complete) {
    complete('3000', 'Development server port');
    complete('8080', 'Alternative port');
  },
  'p'
);

devCmd.option('verbose', 'Enable verbose logging', noopHandler, 'v', true);

// Serve command
const serveCmd = t.command('serve', 'Start the server');
serveCmd.option(
  'host',
  'Specify hostname',
  function (complete) {
    complete('localhost', 'Localhost');
    complete('0.0.0.0', 'All interfaces');
  },
  'H'
);

serveCmd.option(
  'port',
  'Specify port',
  function (complete) {
    complete('3000', 'Development server port');
    complete('8080', 'Alternative port');
  },
  'p'
);

// Build command
t.command('dev build', 'Build project');

// Start command
t.command('dev start', 'Start development server');

// Copy command with multiple arguments
const copyCmd = t
  .command('copy', 'Copy files')
  .argument('source', function (complete) {
    complete('src/', 'Source directory');
    complete('dist/', 'Distribution directory');
    complete('public/', 'Public assets');
  })
  .argument('destination', function (complete) {
    complete('build/', 'Build output');
    complete('release/', 'Release directory');
    complete('backup/', 'Backup location');
  });

// Lint command with variadic arguments
const lintCmd = t.command('lint', 'Lint project').argument(
  'files',
  function (complete) {
    complete('main.ts', 'Main file');
    complete('index.ts', 'Index file');
    complete('src/', 'Source directory');
    complete('tests/', 'Tests directory');
  },
  true
); // Variadic argument for multiple files

// Handle completion command
if (process.argv[2] === 'complete') {
  const shell = process.argv[3];
  if (shell && ['zsh', 'bash', 'fish', 'powershell'].includes(shell)) {
    t.setup('vite', 'pnpm tsx examples/demo.t.ts', shell);
  } else {
    // Parse completion arguments (everything after --)
    const separatorIndex = process.argv.indexOf('--');
    const completionArgs =
      separatorIndex !== -1 ? process.argv.slice(separatorIndex + 1) : [];
    t.parse(completionArgs);
  }
} else {
  // Regular CLI usage (just show help for demo)
  console.log('Vite CLI Demo');
  console.log('Use "complete" command for shell completion');
}
