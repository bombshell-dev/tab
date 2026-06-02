import { Command } from 'commander';
import tab from '../src/commander';

const program = new Command('my-cli');

program
  .command('greet [name]')
  .description('Say hello')
  .action(async (name) => {
    // async handler requires parseAsync()
    console.log(`Hello, ${name ?? 'world'}!`);
  });

const completion = tab(program);

for (const command of completion.commands.values()) {
  if (command.value === 'greet') {
    for (const [_argName, arg] of command.arguments.entries()) {
      arg.handler = (complete) => {
        complete('alice', 'Alice');
        complete('bob', 'Bob');
      };
    }
  }
}

await program.parseAsync();
