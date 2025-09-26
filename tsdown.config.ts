import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    t: 'src/t.ts',
    citty: 'src/citty.ts',
    cac: 'src/cac.ts',
    commander: 'src/commander.ts',
    'bin/cli': 'bin/cli.ts',
    'examples/demo.t': 'examples/demo.t.ts',
    'examples/demo.cac': 'examples/demo.cac.ts',
    'examples/demo.citty': 'examples/demo.citty.ts',
    'examples/demo.commander': 'examples/demo.commander.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
});
