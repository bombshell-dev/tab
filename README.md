> A video showcasing how pnpm autocompletions work on a test CLI command
> like `my-cli`

# tab

Shell autocompletions are largely missing in the JavaScript CLI ecosystem. This tool bridges that gap by autocompletions for `pnpm`, `npm`, `yarn`, and `bun` with dynamic option parsing and context-aware suggestions and also Easy-to-use adapters for popular JavaScript CLI frameworks like CAC, Citty, and Commander.js

As CLI tooling authors, if we can spare our users a second or two by not checking documentation or writing the `-h` flag, we're doing them a huge favor. The unconscious mind loves hitting the [TAB] key and always expects feedback. When nothing happens, it breaks the user's flow - a frustration apparent across the whole JavaScript CLI tooling ecosystem.

Tab solves this complexity by providing autocompletions that work consistently across `zsh`, `bash`, `fish`, and `powershell`.

### Installation

```bash
npm install @bomb.sh/tab
# or
pnpm add @bomb.sh/tab
# or
yarn add @bomb.sh/tab
# or
bun add @bomb.sh/tab
```

### Package Manager Completions

Get autocompletions for your package manager with zero configuration:

```bash
# this generates a completion script for your shell
npx @bomb.sh/tab pnpm zsh >> ~/.zshrc
npx @bomb.sh/tab npm bash >> ~/.bashrc
npx @bomb.sh/tab yarn fish > ~/.config/fish/completions/yarn.fish
npx @bomb.sh/tab bun powershell >> $PROFILE
```

You'd get completions for all commands and options, and dynamic option values e.g., `--reporter=<TAB>`.
**Example in action:**

```bash
pnpm install --reporter=<TAB>
# Shows append-only, default, ndjson, silent

npm remove <TAB>
# Shows the packages from package.json

yarn add --emoji=<TAB>
# Show true, false
```

### CLI Framework Integration

For your own CLI tools, tab provides integration with popular frameworks:

#### Using the Core API

```typescript
import t from '@bomb.sh/tab';

t.command('dev', 'Start development server');
t.option('port', 'Specify port', (complete) => {
  complete('3000', 'Development port');
  complete('8080', 'Production port');
});

// handle completion requests
if (process.argv[2] === 'complete') {
  const shell = process.argv[3];
  if (shell === '--') {
    // parse completion arguments
    const args = process.argv.slice(4);
    t.parse(args);
  } else {
    // generate shell script
    t.setup('my-cli', 'node my-cli.js', shell);
  }
}
```

**Test your completions:**

```bash
node my-cli.js complete -- dev --p<TAB>
# Output: --port  Specify port

node my-cli.js complete -- dev --port=<TAB>
# Output: --port=3000  Development port
#         --port=8080  Production port
```

**Install for users:**

```bash
# One-time setup
source <(my-cli complete zsh)

# Permanent setup
my-cli complete zsh >> ~/.zshrc
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
const devCommand = completion.commands.get('dev');
const portOption = devCommand?.options.get('--port');
if (portOption) {
  portOption.handler = async () => [
    { value: '3000', description: 'Development port' },
    { value: '8080', description: 'Production port' },
  ];
}

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
const devCommand = completion.commands.get('dev');
const portOption = devCommand?.options.get('--port');
if (portOption) {
  portOption.handler = async () => [
    { value: '3000', description: 'Development port' },
    { value: '8080', description: 'Production port' },
  ];
}

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
for (const command of completion.commands.values()) {
  if (command.value === 'serve') {
    const portOption = command.options.get('--port');
    if (portOption) {
      portOption.handler = async () => [
        { value: '3000', description: 'Default port' },
        { value: '8080', description: 'Alternative port' },
      ];
    }
  }
}

program.parse();
```

Tab's package manager completions are dynamically generated from the actual help output of each tool:

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

## Docs

For more detailed documentation, please visit [bombshell docs](https://bomb.sh/docs/tab/)!

## Contributing

We welcome contributions! Tab's architecture makes it easy to add support for new package managers or CLI frameworks.
