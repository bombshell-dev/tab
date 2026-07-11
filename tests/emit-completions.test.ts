import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { emitCompletions, ShellCompDirective, type Completion } from '../src/t';

function captureOutput(fn: (stream: NodeJS.WritableStream) => void): string {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
  fn(stream);
  return Buffer.concat(chunks).toString('utf8');
}

describe('emitCompletions', () => {
  it('writes value/description lines followed by a directive line', () => {
    const completions: Completion[] = [
      { value: '3000', description: 'Development port' },
      { value: '8080', description: 'Production port' },
    ];

    const out = captureOutput((stream) =>
      emitCompletions(
        completions,
        ShellCompDirective.ShellCompDirectiveNoFileComp,
        { stream }
      )
    );

    expect(out).toBe(
      '3000\tDevelopment port\n' +
        '8080\tProduction port\n' +
        `:${ShellCompDirective.ShellCompDirectiveNoFileComp}\n`
    );
  });

  it('treats missing description as empty string', () => {
    const out = captureOutput((stream) =>
      emitCompletions([{ value: 'foo' }], 0, { stream })
    );

    expect(out).toBe('foo\t\n:0\n');
  });

  it('emits only the directive line when there are no completions', () => {
    const out = captureOutput((stream) =>
      emitCompletions([], ShellCompDirective.ShellCompDirectiveNoFileComp, {
        stream,
      })
    );

    expect(out).toBe(`:${ShellCompDirective.ShellCompDirectiveNoFileComp}\n`);
  });

  it('defaults the directive to ShellCompDirectiveDefault (0) when omitted', () => {
    const out = captureOutput((stream) =>
      emitCompletions([{ value: 'a', description: 'A' }], undefined, {
        stream,
      })
    );

    expect(out).toBe('a\tA\n:0\n');
  });

  it('supports composing directives with the bitwise OR operator', () => {
    const directive =
      ShellCompDirective.ShellCompDirectiveNoFileComp |
      ShellCompDirective.ShellCompDirectiveKeepOrder;

    const out = captureOutput((stream) =>
      emitCompletions([{ value: 'x' }], directive, { stream })
    );

    expect(out).toBe(`x\t\n:${directive}\n`);
  });

  it('does not filter, dedup, or reorder the input list', () => {
    // Caller-supplied logic owns filtering. emitCompletions is a pure emitter:
    // duplicates and out-of-prefix entries are passed through verbatim.
    const out = captureOutput((stream) =>
      emitCompletions(
        [
          { value: 'b', description: 'second' },
          { value: 'a', description: 'first' },
          { value: 'b', description: 'duplicate' },
        ],
        0,
        { stream }
      )
    );

    expect(out).toBe('b\tsecond\na\tfirst\nb\tduplicate\n:0\n');
  });
});
