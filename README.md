![tab CLI autocompletions demo](assets/preview.gif)

# tab

Shell autocompletions are largely missing in the JavaScript CLI ecosystem. tab provides a simple API for adding autocompletions to any JavaScript CLI tool.

Additionally, tab supports autocompletions for `pnpm`, `npm`, `yarn`, and `bun`.

Tab has already been adopted by major tools and CLI frameworks, including:

<table align="center">
  <tr>
    <td align="center">
      <a href="https://www.cloudflare.com/">
        <img src="https://github.com/cloudflare.png?size=200" alt="Cloudflare" width="64"><br>
        Cloudflare
      </a>
    </td>
    <td align="center">
      <a href="https://nuxt.com/">
        <img src="https://github.com/nuxt.png?size=200" alt="Nuxt" width="64"><br>
        Nuxt
      </a>
    </td>
    <td align="center">
      <a href="https://astro.build/">
        <img src="https://github.com/withastro.png?size=200" alt="Astro" width="64"><br>
        Astro
      </a>
    </td>
    <td align="center">
      <a href="https://vitest.dev/">
        <img src="https://github.com/vitest-dev.png?size=200" alt="Vitest" width="64"><br>
        Vitest
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/kazupon/gunshi">
        <img src="https://raw.githubusercontent.com/kazupon/gunshi/main/assets/logo.png" alt="Gunshi" width="64"><br>
        Gunshi
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/clercjs/clerc">
        <img src="https://raw.githubusercontent.com/clercjs/clerc/main/docs/public/logo.webp" alt="Clerc" width="64"><br>
        Clerc
      </a>
    </td>
  </tr>
</table>

As CLI tooling authors, if we can spare our users a second or two by not checking documentation or writing the `-h` flag, we're doing them a huge favor. The unconscious mind loves hitting the [TAB] key and always expects feedback. When nothing happens, it breaks the user's flow - a frustration apparent across the whole JavaScript CLI tooling ecosystem.

tab solves this complexity by providing autocompletions that work consistently across `zsh`, `bash`, `fish`, and `powershell`.

## Installation

### For Package Manager Completions

> **Note:** Global install is recommended

```bash
npm install -g @bomb.sh/tab
```

Then enable completions permanently:

```bash
# For zsh
echo 'source <(tab pnpm zsh)' >> ~/.zshrc
source ~/.zshrc

# For bash
echo 'source <(tab pnpm bash)' >> ~/.bashrc
source ~/.bashrc

# The same can be done for other shells!
```

### For CLI Library (Adding Completions to Your CLI)

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

## Installing Completions for Users

Asking users to copy-paste `source <(my-cli complete zsh)` into their shellrc is a friction point. tab ships an installer that detects the user's shell + environment and writes the completion file (or appends to their PowerShell profile) in the right place — no shellrc edits required for most setups.

Use it from a dedicated subcommand, an `init` flow, or a `postinstall` hook:

```typescript
import { installShellCompletions } from '@bomb.sh/tab/install';

// in your `my-cli completions install` handler:
await installShellCompletions({
  name: 'my-cli',          // optional — auto-detected from argv/package.json
  executable: 'my-cli',    // optional — defaults to `name`
  shell: 'auto',           // 'zsh' | 'bash' | 'fish' | 'powershell' | 'auto'
});
```

The installer is **opt-in, idempotent, and never touches `.zshrc` / `.bashrc` on its own.** When it can't complete the install cleanly (e.g. the CLI isn't on PATH, the user's zsh has no `compinit`, macOS bash without `bash-completion`), it returns a structured `needs-user-action` or `blocked` result with concrete remediation steps.

```typescript
const result = await installShellCompletions({ name: 'my-cli', dryRun: true });

result.status;          // 'installed' | 'already-installed' | 'updated'
                        //   | 'needs-user-action' | 'blocked' | 'failed'
result.actions;         // files we wrote / would write (with `performed` flag)
result.userInstructions;// numbered next-steps the user must take, if any
result.warnings;        // e.g. detected a conflicting Homebrew completion
result.detected;        // PATH reachability, install method, shell env probe
```

**Options**

| Option | Default | Description |
| --- | --- | --- |
| `name` | auto-detected | Command name (drives filenames: `_my-cli`, `my-cli.fish`, …) |
| `executable` | `name` | How to invoke the CLI from the generated completion script |
| `shell` | `'auto'` | Target shell, or `'auto'` to detect from the current process |
| `dryRun` | `false` | Compute the plan without writing anything |
| `force` | `false` | Overwrite an existing completion file we did not manage |
| `print` | `'on-error'` | Print a summary to stderr — `true`, `false`, or `'on-error'` |
| `verbose` | `false` | Log detection steps to stderr |

**What the installer covers per shell**

| Shell | Target | When the user has to do something |
| --- | --- | --- |
| fish | `~/.config/fish/completions/<name>.fish` | never |
| zsh  | first writable `$fpath` dir, else Homebrew `site-functions`, else `~/.zsh/completions` | only if `compinit` is missing or the target dir isn't in `$fpath` (clear instructions are returned) |
| bash | `$XDG_DATA_HOME/bash-completion/completions/<name>` | only if `bash-completion` isn't installed (macOS default bash) — install hint is returned |
| powershell | sentinel-wrapped block in `$PROFILE.CurrentUserAllHosts` | only if execution policy is `Restricted` |

The installer always returns its result — you can render your own UI, print the structured plan, or chain it into a larger `init` flow.

### Uninstalling

A matching `uninstallShellCompletions` removes whatever the installer wrote. It only touches files that carry our `managed-by=tab` marker (or sentinel-wrapped blocks in PowerShell profiles), so it won't clobber a user's hand-written or Homebrew-installed completion.

```typescript
import { uninstallShellCompletions } from '@bomb.sh/tab/install';

await uninstallShellCompletions({
  name: 'my-cli',
  shell: 'auto',
});
```

For zsh, the uninstaller walks every dir we might have written to (current `$fpath`, Homebrew `site-functions`, `~/.zsh/completions`) so it cleans up even if the user's environment has changed since install. `dryRun`, `force`, `print`, and `verbose` work the same way as on the installer.

## Package Manager Completions

As mentioned earlier, tab provides completions for package managers as well:

```bash
# Generate and install completion scripts
tab pnpm zsh > ~/.pnpm-completion.zsh && echo 'source ~/.pnpm-completion.zsh' >> ~/.zshrc
tab npm bash > ~/.npm-completion.bash && echo 'source ~/.npm-completion.bash' >> ~/.bashrc
tab yarn fish > ~/.config/fish/completions/yarn.fish
tab bun powershell > ~/.bun-completion.ps1 && echo '. ~/.bun-completion.ps1' >> $PROFILE
```

Example in action:

```bash
pnpm install --reporter=<TAB>
# Shows: append-only, default, ndjson, silent

yarn add --emoji=<TAB>
# Shows: true, false
```

### Completing locally-installed CLIs

Package manager completion does more than complete the package manager's own flags — it also **delegates to CLIs installed as local project dependencies**. If a CLI implements tab's completion protocol (directly or via a [framework adapter](#framework-adapters)), it becomes completable through your package manager _without_ being on your `PATH` and without installing its completion script separately:

```bash
pnpm exec my-cli <TAB>      # completes my-cli's subcommands and flags
pnpm dlx my-cli <TAB>
pnpm my-cli <TAB>           # the bare form works too
```

Under the hood, tab strips the package-manager wrapper (`exec`, `x`, `run`, `dlx`), detects whether the target CLI supports completion, and forwards the request to it — falling back to running the CLI _through_ the package manager (e.g. `pnpm my-cli complete -- …`) so locally-installed binaries resolve. The same works for `npm exec`, `yarn`, and `bun x`.

> **Note:** Completion is registered against the package-manager binary (`npm`, `pnpm`, `yarn`, `bun`). `npx` and `bunx` are separate commands with no completion of their own, so `npx my-cli <TAB>` / `bunx my-cli <TAB>` won't complete — use `npm exec my-cli` / `bun x my-cli` instead.

## Framework Adapters

tab provides adapters for popular JavaScript CLI frameworks.

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
const completion = await tab(cli);

// Add custom completions for option values
const devCommand = completion.commands.get('dev');
const portOption = devCommand?.options.get('port');
if (portOption) {
  portOption.handler = (complete) => {
    complete('3000', 'Development port');
    complete('8080', 'Production port');
  };
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
const portOption = devCommand?.options.get('port');
if (portOption) {
  portOption.handler = (complete) => {
    complete('3000', 'Development port');
    complete('8080', 'Production port');
  };
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
const serveCommand = completion.commands.get('serve');
const portOption = serveCommand?.options.get('port');
if (portOption) {
  portOption.handler = (complete) => {
    complete('3000', 'Default port');
    complete('8080', 'Alternative port');
  };
}

program.parse();
```

The Commander integration supports customising the command name to generate the shell completion script. The default is `complete`. If you use a custom name
like `completion` then it will be visible in the help as `completion <shell>`, while the runtime suggestions will be hiddden (`complete -- [args...]`).
You'll need to use your custom command when following examples on this page to generate the shell completion script.

```javascript
const completion = tab(program, { completionCommandName: 'completion' });
```

### Custom Integrations

tab uses a standardized completion protocol that any CLI can implement:

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

We welcome contributions! tab's architecture makes it easy to add support for new package managers or CLI frameworks.

## Acknowledgments

tab was inspired by the great [Cobra](https://github.com/spf13/cobra/) project, which set the standard for CLI tooling in the Go ecosystem.

## Adoption Support

We want to make it as easy as possible for the JS ecosystem to enjoy great autocompletions.  
We at [thundraa](https://thundraa.com) would be happy to help any open source CLI utility adopt tab.
If you maintain a CLI and would like autocompletions set up for your users, just [drop the details in our _Adopting tab_ discussion](https://github.com/bombshell-dev/tab/discussions/61).  
We’ll gladly help and even open a PR to get you started.
