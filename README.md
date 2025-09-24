![Tab CLI autocompletions demo](assets/preview.gif)

# tab

Shell autocompletions are largely missing in the JavaScript CLI ecosystem. Tab provides a simple API for adding autocompletions to any JavaScript CLI tool.

Additionally, tab supports autocompletions for `pnpm`, `npm`, `yarn`, and `bun`.

As CLI tooling authors, if we can spare our users a second or two by not checking documentation or writing the `-h` flag, we're doing them a huge favor. The unconscious mind loves hitting the [TAB] key and always expects feedback. When nothing happens, it breaks the user's flow - a frustration apparent across the whole JavaScript CLI tooling ecosystem.

Tab solves this complexity by providing autocompletions that work consistently across `zsh`, `bash`, `fish`, and `powershell`.

## Installation

```bash
npm install @bomb.sh/tab
# or
pnpm add @bomb.sh/tab
# or
yarn add @bomb.sh/tab
# or
bun add @bomb.sh/tab
```

## Quick Start

Add autocompletions to your CLI tool:

```typescript
import t from '@bomb.sh/tab';

// Define your CLI structure
const devCmd = t.command('dev', 'Start development server');
devCmd.option('port', 'Specify port', (complete) => {
  complete('3000', 'Development port');
  complete('8080', 'Production port');
});

// Handle completion requests
if (process.argv[2] === 'complete') {
  const shell = process.argv[3];
  if (shell === '--') {
    const args = process.argv.slice(4);
    t.parse(args);
  } else {
    t.setup('my-cli', 'node my-cli.js', shell);
  }
}
```

Test your completions:

```bash
node my-cli.js complete -- dev --port=<TAB>
# Output: --port=3000  Development port
#         --port=8080  Production port
```

Install for users:

```bash
# One-time setup
source <(my-cli complete zsh)

# Permanent setup
my-cli complete zsh > ~/.my-cli-completion.zsh
echo 'source ~/.my-cli-completion.zsh' >> ~/.zshrc
```

## Package Manager Completions

As mentioned earlier, tab provides completions for package managers as well:

```bash
# Generate and install completion scripts
npx @bomb.sh/tab pnpm zsh > ~/.pnpm-completion.zsh && echo 'source ~/.pnpm-completion.zsh' >> ~/.zshrc
npx @bomb.sh/tab npm bash > ~/.npm-completion.bash && echo 'source ~/.npm-completion.bash' >> ~/.bashrc
npx @bomb.sh/tab yarn fish > ~/.config/fish/completions/yarn.fish
npx @bomb.sh/tab bun powershell > ~/.bun-completion.ps1 && echo '. ~/.bun-completion.ps1' >> $PROFILE
```

Example in action:

```bash
pnpm install --reporter=<TAB>
# Shows: append-only, default, ndjson, silent (with descriptions)

yarn add --emoji=<TAB>
# Shows: true, false
```

## Framework Adapters

Tab provides adapters for popular JavaScript CLI frameworks.

### CAC Integration

```typescript
import cac from 'cac';
import tab from '@bomb.sh/tab/cac';

const cli = cac('my-cli');

// Define your CLI
cli
  .command('dev', 'Start dev server')
  .option('--port <port>', 'Specify port')
  .option('--host <host>', 'Specify host');

// Initialize tab completions
const completion = tab(cli);

// Add custom completions for option values
completion.commands.get('dev')?.options.get('--port')!.handler = async () => [
  { value: '3000', description: 'Development port' },
  { value: '8080', description: 'Production port' },
];

cli.parse();
```

### Citty Integration

```typescript
import { defineCommand, createMain } from 'citty';
import tab from '@bomb.sh/tab/citty';

const main = defineCommand({
  meta: { name: 'my-cli', description: 'My CLI tool' },
  subCommands: {
    dev: defineCommand({
      meta: { name: 'dev', description: 'Start dev server' },
      args: {
        port: { type: 'string', description: 'Specify port' },
        host: { type: 'string', description: 'Specify host' },
      },
    }),
  },
});

// Initialize tab completions
const completion = await tab(main);

// Add custom completions
completion.commands.get('dev')?.options.get('--port')!.handler = async () => [
  { value: '3000', description: 'Development port' },
  { value: '8080', description: 'Production port' },
];

const cli = createMain(main);
cli();
```

### Commander.js Integration

```typescript
import { Command } from 'commander';
import tab from '@bomb.sh/tab/commander';

const program = new Command('my-cli');
program.version('1.0.0');

// Define commands
program
  .command('serve')
  .description('Start the server')
  .option('-p, --port <number>', 'port to use', '3000')
  .option('-H, --host <host>', 'host to use', 'localhost')
  .action((options) => {
    console.log('Starting server...');
  });

// Initialize tab completions
const completion = tab(program);

// Add custom completions
completion.commands.get('serve')?.options.get('--port')!.handler = async () => [
  { value: '3000', description: 'Default port' },
  { value: '8080', description: 'Alternative port' },
];

program.parse();
```

Tab uses a standardized completion protocol that any CLI can implement:

```bash
# Generate shell completion script
my-cli complete zsh

# Parse completion request (called by shell)
my-cli complete -- install --port=""
```

**Output Format:**

```
--port=3000    Development port
--port=8080    Production port
:4
```

## Documentation

See [bombshell docs](https://bomb.sh/docs/tab/).

## Contributing

We welcome contributions! Tab's architecture makes it easy to add support for new package managers or CLI frameworks.
