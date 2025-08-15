import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/t.ts',
    'src/citty.ts',
    'src/cac.ts',
    'src/commander.ts',
    'bin/cli.ts',
    'examples/demo.t.ts',
    'examples/demo.cac.ts',
    'examples/demo.citty.ts',
    'examples/demo.commander.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
});
