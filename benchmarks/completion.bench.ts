import { Bench } from 'tinybench';
import { RootCommand } from '../src/t';

const bench = new Bench({ time: 1000 });

const setupCompletion = () => {
  const completion = new RootCommand();
  completion.command('dev', 'Start dev server');
  completion.command('build', 'Build project');
  completion.command('test', 'Run tests');

  completion.option('--config', 'Config file');
  completion.option('--verbose', 'Verbose output');

  const devCommand = completion.commands.get('dev')!;
  devCommand.option('--port', 'Port number', function (complete) {
    complete('3000', 'Development port');
    complete('8080', 'Alternative port');
  });

  return completion;
};

const suppressOutput = (fn: () => void) => {
  const originalLog = console.log;
  console.log = () => {};
  fn();
  console.log = originalLog;
};

bench.add('command completion', () => {
  const completion = setupCompletion();
  suppressOutput(() => completion.parse(['d']));
});

bench.add('option completion', () => {
  const completion = setupCompletion();
  suppressOutput(() => completion.parse(['dev', '--p']));
});

bench.add('option value completion', () => {
  const completion = setupCompletion();
  suppressOutput(() => completion.parse(['dev', '--port', '']));
});

bench.add('no match', () => {
  const completion = setupCompletion();
  suppressOutput(() => completion.parse(['xyz']));
});

bench.add('large command set', () => {
  const completion = new RootCommand();
  for (let i = 0; i < 100; i++) {
    completion.command(`cmd${i}`, `Command ${i}`);
  }
  suppressOutput(() => completion.parse(['cmd5']));
});

async function runBenchmarks() {
  await bench.run();

  console.table(
    bench.tasks.map((task) => ({
      name: task.name,
      'ops/sec': task.result?.hz
        ? Math.round(task.result.hz).toLocaleString()
        : 'N/A',
      'avg (ms)': task.result?.mean
        ? (task.result.mean * 1000).toFixed(3)
        : 'N/A',
    }))
  );
}

if (process.argv[1]?.endsWith('completion.bench.ts')) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };
