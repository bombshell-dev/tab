import { Argument, Command, Option } from 'commander';
import tab from '../../src/commander';

const program = new Command('commander-option-scope');

if (process.env.COMMANDER_POSITIONAL === '1') {
  program.enablePositionalOptions();
}

program
  .addOption(
    new Option('-c, --root-choice <value>', 'Root choice').choices([
      'top',
      'global',
    ])
  )
  .addOption(new Option('-b, --root-boolean', 'Root boolean'));

const serve = program
  .command('serve')
  .description('Serve the app')
  .addOption(
    new Option('-c, --leaf-choice <value>', 'Leaf choice').choices([
      'leaf',
      'local',
    ])
  )
  .addOption(
    new Option('-b, --leaf-value <value>', 'Leaf value').choices([
      'blue',
      'green',
    ])
  )
  .addOption(
    new Option('-a, --ancestor-choice <value>', 'Ancestor choice').choices([
      'parent',
      'ancestor',
    ])
  )
  .addArgument(
    new Argument('[environment]', 'Environment').choices(['prod', 'staging'])
  );

serve
  .command('nested')
  .description('Nested command')
  .addOption(
    new Option('-a, --nested-choice <value>', 'Nested choice').choices([
      'deep',
      'nested',
    ])
  );

const completion = tab(program);
completion.parse(process.argv.slice(2));
