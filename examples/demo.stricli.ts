/**
 * Stricli + tab integration demo.
 *
 * This shows how a CLI that already implements its own completion-resolution
 * logic (the (a) half) can plug into tab purely for the shell-protocol /
 * shell-script half (the (b) half).
 *
 * The shape is:
 *   - `<exec> complete <shell>`   -> tab generates the shell script
 *   - `<exec> complete -- <argv>` -> stricli computes completions, tab emits
 *                                    them in the wire format the script reads
 *
 * Run any of:
 *   pnpm tsx examples/demo.stricli.ts complete -- ""
 *   pnpm tsx examples/demo.stricli.ts complete -- dev --port=
 *   pnpm tsx examples/demo.stricli.ts complete -- dev --mode prod
 *   pnpm tsx examples/demo.stricli.ts complete bash
 */
import {
  buildApplication,
  buildCommand,
  buildRouteMap,
  numberParser,
  proposeCompletions,
  type InputCompletion,
} from '@stricli/core';
import {
  emitCompletions,
  script,
  ShellCompDirective,
  type Completion,
  type Directive,
} from '../src/t';

// --- (1) Build a tiny stricli application ----------------------------------

const devCommand = buildCommand({
  loader: async () => () => {
    /* impl not needed for completion demo */
  },
  parameters: {
    flags: {
      port: {
        kind: 'parsed',
        parse: numberParser,
        brief: 'Port to listen on',
        optional: true,
      },
      mode: {
        kind: 'enum',
        values: ['development', 'production'] as const,
        brief: 'Build mode',
        optional: true,
      },
      verbose: {
        kind: 'boolean',
        brief: 'Enable verbose logging',
        optional: true,
      },
    },
  },
  docs: { brief: 'Start dev server' },
});

const buildCmd = buildCommand({
  loader: async () => () => {},
  parameters: { flags: {} },
  docs: { brief: 'Build the project' },
});

const root = buildRouteMap({
  routes: { dev: devCommand, build: buildCmd },
  docs: { brief: 'Demo CLI using stricli for (a) and tab for (b)' },
});

const app = buildApplication(root, {
  name: 'demo-stricli',
  versionInfo: { currentVersion: '0.0.0' },
});

// --- (2) Wire up the `complete` subcommand ---------------------------------

async function main() {
  const argv = process.argv.slice(2);

  if (argv[0] !== 'complete') {
    console.log('Demo CLI. Use "complete <shell>" or "complete -- <args>".');
    return;
  }

  const second = argv[1];
  const SUPPORTED_SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;
  type Shell = (typeof SUPPORTED_SHELLS)[number];

  // a) `complete <shell>` -> use tab to print the shell-side completion script
  if (second && (SUPPORTED_SHELLS as readonly string[]).includes(second)) {
    script(
      second as Shell,
      'demo-stricli',
      'pnpm tsx examples/demo.stricli.ts'
    );
    return;
  }

  // b) `complete -- <args>` -> use stricli to compute completions,
  //    then hand the finished list to tab to emit on the wire.
  if (second === '--') {
    const inputs = argv.slice(2);
    const stricliCompletions = await proposeCompletions(app, inputs, {
      process,
    });

    const completions = stricliCompletions.map(toTabCompletion);
    const directive: Directive =
      ShellCompDirective.ShellCompDirectiveNoFileComp;
    emitCompletions(completions, directive);
    return;
  }

  console.error('Usage: complete <shell>  |  complete -- <args>');
  process.exit(1);
}

/**
 * Map stricli's `InputCompletion` shape ({ kind, completion, brief }) to tab's
 * `Completion` shape ({ value, description }). The `kind` is informational
 * only — tab's wire format doesn't care about it.
 */
function toTabCompletion(c: InputCompletion): Completion {
  return { value: c.completion, description: c.brief };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
