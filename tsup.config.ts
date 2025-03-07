import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/citty.ts', 'src/cac.ts', 'src/commander.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
