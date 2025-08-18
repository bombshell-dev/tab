import { Bench } from 'tinybench';
import { promisify } from 'node:util';
import { exec as execCb } from 'node:child_process';

const exec = promisify(execCb);

const bench = new Bench({ time: 2000 });

const cmdPrefix = `${process.execPath} ./dist/examples/demo.t.js complete --`;

async function run(cmd: string) {
  await exec(cmd);
}

bench.add('command completion', async () => {
  await run(`${cmdPrefix} d`);
});

bench.add('option completion', async () => {
  await run(`${cmdPrefix} dev --p`);
});

bench.add('option value completion', async () => {
  await run(`${cmdPrefix} dev --port ""`);
});

bench.add('config value completion', async () => {
  await run(`${cmdPrefix} --config ""`);
});

bench.add('no match', async () => {
  await run(`${cmdPrefix} xyz`);
});

async function runBenchmarks() {
  await bench.run();

  console.table(
    bench.tasks.map((task) => {
      const hz = task.result?.hz;
      const derivedMs =
        typeof hz === 'number' && hz > 0 ? 1000 / hz : undefined;
      const mean = task.result?.mean;
      return {
        name: task.name,
        'ops/sec': hz ? Math.round(hz).toLocaleString() : 'N/A',
        'avg (ms)':
          derivedMs !== undefined
            ? derivedMs.toFixed(3)
            : mean !== undefined
              ? (mean * 1000).toFixed(3)
              : 'N/A',
      };
    })
  );
}

if (process.argv[1]?.endsWith('completion.bench.ts')) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };
