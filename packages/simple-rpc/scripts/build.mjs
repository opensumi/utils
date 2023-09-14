// @ts-check
import esbuild from 'esbuild';
import { rm } from 'fs/promises';

/**
 * @type {esbuild.BuildOptions}
 */
const sharedOptions = {
  sourcemap: 'external',
  sourcesContent: true,
  minify: false,
  allowOverwrite: true,
  packages: 'external',
};

async function main() {
  // Start with a clean slate
  await rm('esm', { recursive: true, force: true });
  await rm('lib', { recursive: true, force: true });
  await rm('types', { recursive: true, force: true });

  const entryPoints = ['./src/index.ts'];

  await Promise.all([
    esbuild.build({
      entryPoints,
      outdir: 'lib',
      bundle: true,
      platform: 'neutral',
      format: 'cjs',
      ...sharedOptions,
    }),
    esbuild.build({
      entryPoints,
      outdir: 'esm',
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      ...sharedOptions,
    }),
  ]);
}

main();
