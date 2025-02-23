import cac from 'cac';
import tab from './src/cac';

const cli = cac('vite');

cli
  .option('-c, --config <file>', `Use specified config file`)
  .option('-m, --mode <mode>', `Set env mode`)
  .option('-l, --logLevel <level>', `info | warn | error | silent`);

cli
  .command('dev', 'Start dev server')
  .option('-H, --host [host]', `Specify hostname`)
  .option('-p, --port <port>', `Specify port`)
  .action((options) => {});

cli.command('dev build', 'Build project').action((options) => {});

cli.command('lint [...files]', 'Lint project').action((files, options) => {});

const completion = await tab(cli);

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

cli.parse();
