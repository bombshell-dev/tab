import { cac } from 'cac';
import tab from './dist/src/cac.js';

const cli = cac('test-cli');

cli
  .command('dev', 'Start development server')
  .option('--port <port>', 'Port number')
  .option('--verbose', 'Verbose output');

const completion = await tab(cli);

const devCommand = completion.commands.get('dev');
const portOption = devCommand?.options.get('port');
const verboseOption = devCommand?.options.get('verbose');

if (portOption) {
  portOption.handler = (complete) => {
    complete('3000', 'Development port');
    complete('8080', 'Production port');
  };
}

console.log('Port option (should be value-taking):', portOption?.isBoolean);
console.log('Verbose option (should be boolean):', verboseOption?.isBoolean);

cli.parse();
