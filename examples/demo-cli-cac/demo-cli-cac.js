#!/usr/bin/env node

import cac from 'cac';
import tab from '../../dist/cac.js';

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
    if (optionName === 'port') {
      config.handler = function (complete) {
        complete('3000', 'Default port');
        complete('8080', 'Alternative port');
      };
    }

    if (optionName === 'mode') {
      config.handler = function (complete) {
        complete('development', 'Development mode');
        complete('production', 'Production mode');
        complete('test', 'Test mode');
      };
    }

    if (optionName === 'config') {
      config.handler = function (complete) {
        complete('config.json', 'JSON config file');
        complete('config.js', 'JavaScript config file');
      };
    }
  }
}

// for root command options
for (const [optionName, config] of completion.options.entries()) {
  if (optionName === 'config') {
    config.handler = function (complete) {
      complete('config.json', 'JSON config file');
      complete('config.js', 'JavaScript config file');
    };
  }
}

cli.parse();
