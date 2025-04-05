[![tweet-1827921103093932490](https://github.com/user-attachments/assets/21521787-7936-44be-8d3c-8214cd2fcee9)](https://x.com/karpathy/status/1827921103093932490)

# tab

Shell autocompletions are largely missing in the javascript cli ecosystem. This tool is an attempt to make autocompletions come out of the box for any cli tool.

Tools like git and their autocompletion experience inspired us to build this tool and make the same ability available for any javascript cli project. Developers love hitting the tab key, hence why they prefer tabs over spaces.

## Examples

Check out the [examples directory](./examples) for complete examples of using Tab with different command-line frameworks:

- [CAC](./examples/demo.cac.ts)
- [Citty](./examples/demo.citty.ts)
- [Commander.js](./examples/demo.commander.ts)

## Usage

```ts
import { Completion, script } from '@bombsh/tab';

const name = 'my-cli';
const completion = new Completion();

completion.addCommand(
  'start',
  'Start the application',
  async (previousArgs, toComplete, endsWithSpace) => {
    // suggestions
    return [
      { value: 'dev', description: 'Start in development mode' },
      { value: 'prod', description: 'Start in production mode' },
    ];
  }
);

completion.addOption(
  'start',
  '--port',
  'Specify the port number',
  async (previousArgs, toComplete, endsWithSpace) => {
    return [
      { value: '3000', description: 'Development port' },
      { value: '8080', description: 'Production port' },
    ];
  }
);

// a way of getting the executable path to pass to the shell autocompletion script
function quoteIfNeeded(path: string) {
  return path.includes(' ') ? `'${path}'` : path;
}
const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const quotedExecPath = quoteIfNeeded(execPath);
const quotedProcessArgs = processArgs.map(quoteIfNeeded);
const quotedProcessExecArgs = process.execArgv.map(quoteIfNeeded);
const x = `${quotedExecPath} ${quotedProcessExecArgs.join(' ')} ${quotedProcessArgs[0]}`;

if (process.argv[2] === '--') {
  // autocompletion logic
  await completion.parse(process.argv.slice(2), 'start'); // TODO: remove "start"
} else {
  // process.argv[2] can be "zsh", "bash", "fish", "powershell"
  script(process.argv[2], name, x);
}
```

Now your user can run `source <(my-cli complete zsh)` and they will get completions for the `my-cli` command using the [autocompletion server](#autocompletion-server).

## Adapters

Since we are heavy users of tools like `cac` and `citty`, we have created adapters for both of them. Ideally, tab would be integrated internally into these tools, but for now, this is a good compromise.

### `@bombsh/tab/cac`

```ts
import cac from 'cac';
import tab from '@bombsh/tab/cac';

const cli = cac('my-cli');

cli.command('dev', 'Start dev server').option('--port <port>', 'Specify port');

const completion = tab(cli);

// Get the dev command completion handler
const devCommandCompletion = completion.commands.get('dev');

// Get and configure the port option completion handler
const portOptionCompletion = devCommandCompletion.options.get('--port');
portOptionCompletion.handler = async (
  previousArgs,
  toComplete,
  endsWithSpace
) => {
  return [
    { value: '3000', description: 'Development port' },
    { value: '8080', description: 'Production port' },
  ];
};

cli.parse();
```

Now autocompletion will be available for any specified command and option in your cac instance. If your user writes `my-cli dev --po`, they will get suggestions for the `--port` option. Or if they write `my-cli d` they will get suggestions for the `dev` command.

Suggestions are missing in the adapters since yet cac or citty do not have a way to provide suggestions (tab just came out!), we'd have to provide them manually. Mutations do not hurt in this situation.

### `@bombsh/tab/citty`

```ts
import citty, { defineCommand, createMain } from 'citty';
import tab from '@bombsh/tab/citty';

const main = defineCommand({
  meta: {
    name: 'my-cli',
    description: 'My CLI tool',
  },
});

const devCommand = defineCommand({
  meta: {
    name: 'dev',
    description: 'Start dev server',
  },
  args: {
    port: { type: 'string', description: 'Specify port' },
  },
});

main.subCommands = {
  dev: devCommand,
};

const completion = await tab(main);

// TODO: addHandler function to export
const devCommandCompletion = completion.commands.get('dev');

const portOptionCompletion = devCommandCompletion.options.get('--port');

portOptionCompletion.handler = async (
  previousArgs,
  toComplete,
  endsWithSpace
) => {
  return [
    { value: '3000', description: 'Development port' },
    { value: '8080', description: 'Production port' },
  ];
};

const cli = createMain(main);
cli();
```

### `@bombsh/tab/commander`

```ts
import { Command } from 'commander';
import tab from '@bombsh/tab/commander';

const program = new Command('my-cli');
program.version('1.0.0');

// Add commands
program
  .command('serve')
  .description('Start the server')
  .option('-p, --port <number>', 'port to use', '3000')
  .option('-H, --host <host>', 'host to use', 'localhost')
  .action((options) => {
    console.log('Starting server...');
  });

// Initialize tab completion
const completion = tab(program);

// Configure custom completions
for (const command of completion.commands.values()) {
  if (command.name === 'serve') {
    for (const [option, config] of command.options.entries()) {
      if (option === '--port') {
        config.handler = () => {
          return [
            { value: '3000', description: 'Default port' },
            { value: '8080', description: 'Alternative port' },
          ];
        };
      }
    }
  }
}

program.parse();
```

## Recipe

`source <(my-cli complete zsh)` won't be enough since the user would have to run this command each time they spin up a new shell instance.

We suggest this approach for the end user that you as a maintainer might want to push.

```
my-cli completion zsh > ~/completion-for-my-cli.zsh
echo 'source ~/completion-for-my-cli.zsh' >> ~/.zshrc
```

For other shells:

```bash
# Bash
my-cli complete bash > ~/.bash_completion.d/my-cli
echo 'source ~/.bash_completion.d/my-cli' >> ~/.bashrc

# Fish
my-cli complete fish > ~/.config/fish/completions/my-cli.fish

# PowerShell
my-cli complete powershell > $PROFILE.CurrentUserAllHosts
```

## Autocompletion Server

By integrating tab into your cli, your cli would have a new command called `complete`. This is where all the magic happens. And the shell would contact this command to get completions. That's why we call it the autocompletion server.

```zsh
my-cli complete -- --po
--port  Specify the port number
:0
```

The autocompletion server can be a standard to identify whether a package provides autocompletions. Whether running `tool complete --` would result in an output that ends with `:{Number}` (matching the pattern `/:\d+$/`).

In situations like `my-cli dev --po` you'd have autocompletions! But in the case of `pnpm my-cli dev --po` which is what most of us use, tab does not inject autocompletions for a tool like pnpm.

Since pnpm already has its own autocompletion [script](https://pnpm.io/completion), this provides the opportunity to check whether a package provides autocompletions and use those autocompletions if available.

This would also have users avoid injecting autocompletions in their shell config for any tool that provides its own autocompletion script, since pnpm would already support proxying the autocompletions out of the box.

Other package managers like `npm` and `yarn` can decide whether to support this or not too for more universal support.

## Inspiration

- git
- [cobra](https://github.com/spf13/cobra/blob/main/shell_completions.go), without cobra, tab would have took 10x longer to build
