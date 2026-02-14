import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/t.ts',
    citty: 'src/citty.ts',
    cac: 'src/cac.ts',
    commander: 'src/commander.ts',
    'bin/cli': 'bin/cli.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
  treeshake: true,
  exports: true,
});
