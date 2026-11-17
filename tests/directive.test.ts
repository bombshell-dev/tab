import { describe, it, expect, vi, afterEach } from 'vitest';
import { RootCommand, ShellCompDirective } from '../src/t';

function parse(root: RootCommand, args: string[]): string[] {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  root.parse(args);
  return log.mock.calls.map(([line]) => String(line));
}

describe('completion directive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables file completion by default', () => {
    const root = new RootCommand();
    root.command('build', 'Build').option('out', 'Output file', () => {});

    expect(parse(root, ['build', '--out', ''])).toEqual([
      `:${ShellCompDirective.ShellCompDirectiveNoFileComp}`,
    ]);
  });

  it('keeps a directive set by an option handler', () => {
    const root = new RootCommand();
    root.command('build', 'Build').option('out', 'Output file', () => {
      root.directive = ShellCompDirective.ShellCompDirectiveDefault;
    });

    expect(parse(root, ['build', '--out', ''])).toEqual([
      `:${ShellCompDirective.ShellCompDirectiveDefault}`,
    ]);
  });

  it('keeps a directive set by an argument handler', () => {
    const root = new RootCommand();
    root.command('serve', 'Serve').argument('dir', () => {
      root.directive = ShellCompDirective.ShellCompDirectiveFilterDirs;
    });

    expect(parse(root, ['serve', ''])).toEqual([
      `:${ShellCompDirective.ShellCompDirectiveFilterDirs}`,
    ]);
  });

  it('resets the directive for the next completion request', () => {
    const root = new RootCommand();
    const build = root.command('build', 'Build');
    build.option('out', 'Output file', () => {
      root.directive = ShellCompDirective.ShellCompDirectiveDefault;
    });
    build.option('mode', 'Build mode', (complete) => {
      complete('production', '');
    });

    parse(root, ['build', '--out', '']);

    expect(parse(root, ['build', '--mode', ''])).toEqual([
      'production\t',
      `:${ShellCompDirective.ShellCompDirectiveNoFileComp}`,
    ]);
  });
});
