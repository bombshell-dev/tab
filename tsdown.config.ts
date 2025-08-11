import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/t.ts',
    'src/citty.ts',
    'src/cac.ts',
    'src/commander.ts',
    'bin/cli.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
});
