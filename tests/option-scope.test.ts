import { describe, expect, it, vi } from 'vitest';
import { RootCommand } from '../src/t';

function completionValues(root: RootCommand, args: string[]): string[] {
  const output: string[] = [];
  const log = vi
    .spyOn(console, 'log')
    .mockImplementation((line: string) => output.push(line));

  try {
    root.parse([...args]);
  } finally {
    log.mockRestore();
  }

  return output
    .filter((line) => !line.startsWith(':'))
    .map((line) => line.split('\t')[0]);
}

function rootBooleanAndSubcommandValue(): RootCommand {
  const root = new RootCommand();
  root.option('help', 'Display help', 'h');

  const serve = root.command('serve', 'Serve the app');
  serve.option(
    'host',
    'Host name',
    (complete) => complete('localhost', ''),
    'h'
  );
  serve.argument('env', (complete) => {
    complete('prod', '');
    complete('staging', '');
  });

  return root;
}

describe('option scope', () => {
  it('uses the matched command alias when completing an option value', () => {
    const root = rootBooleanAndSubcommandValue();

    expect(completionValues(root, ['serve', '-h', ''])).toEqual(['localhost']);
  });

  it('does not count a matched command option value as a positional argument', () => {
    const root = rootBooleanAndSubcommandValue();

    expect(completionValues(root, ['serve', '-h', 'localhost', ''])).toEqual([
      'prod',
      'staging',
    ]);
  });

  it('keeps resolving an alias before the command name against the root', () => {
    const root = rootBooleanAndSubcommandValue();

    expect(completionValues(root, ['-h', ''])).toEqual(['serve']);
  });

  it('does not use an earlier sibling command to determine option arity', () => {
    const root = new RootCommand();
    root.command('first', 'First command').option('help', 'Display help', 'h');

    const second = root.command('second', 'Second command');
    second.option(
      'host',
      'Host name',
      (complete) => complete('localhost', ''),
      'h'
    );
    second.argument('env', (complete) => complete('prod', ''));

    expect(completionValues(root, ['second', '-h', ''])).toEqual(['localhost']);
  });

  it('does not use a root value option when the matched command alias is boolean', () => {
    const root = new RootCommand();
    root.option(
      'home',
      'Home directory',
      (complete) => complete('/tmp/home', ''),
      'h'
    );

    const serve = root.command('serve', 'Serve the app');
    serve.option('help', 'Display help', 'h');
    serve.argument('env', (complete) => {
      complete('prod', '');
      complete('staging', '');
    });

    expect(completionValues(root, ['serve', '-h', ''])).toEqual([
      'prod',
      'staging',
    ]);
  });

  it('resolves a colliding long option against the matched command', () => {
    const root = new RootCommand();
    root.option('config', 'Enable configuration');

    const serve = root.command('serve', 'Serve the app');
    serve.option('config', 'Configuration file', (complete) =>
      complete('serve.config.ts', '')
    );
    serve.argument('env', (complete) => complete('prod', ''));

    expect(completionValues(root, ['serve', '--config', ''])).toEqual([
      'serve.config.ts',
    ]);
  });
});
