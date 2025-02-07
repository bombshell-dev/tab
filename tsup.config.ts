import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/citty.ts', 'src/cac.ts'],
    format: ['esm'],
    dts: false,
    clean: true,
    skipNodeModulesBundle: true,
    esbuildOptions(options) {
        options.loader = { '.ts': 'ts' };
    },
});
