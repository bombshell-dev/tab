#!/usr/bin/env node

import cac from 'cac';
import tab from '../../dist/src/cac.js';

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

// Set up completion using the cac adapter
const completion = await tab(cli);

// custom config for options
for (const command of completion.commands.values()) {
  for (const [optionName, config] of command.options.entries()) {
    if (optionName === '--port') {
      config.handler = () => {
        return [
          { value: '3000', description: 'Default port' },
          { value: '8080', description: 'Alternative port' },
        ];
      };
    }

    if (optionName === '--mode') {
      config.handler = () => {
        return [
          { value: 'development', description: 'Development mode' },
          { value: 'production', description: 'Production mode' },
          { value: 'test', description: 'Test mode' },
        ];
      };
    }

    if (optionName === '--config') {
      config.handler = () => {
        return [
          { value: 'config.json', description: 'JSON config file' },
          { value: 'config.js', description: 'JavaScript config file' },
        ];
      };
    }
  }
}

cli.parse();
