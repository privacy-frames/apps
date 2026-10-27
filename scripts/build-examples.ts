import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repository = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(repository, 'examples');
const defaultOutput = resolve(repository, 'dist-examples');

async function compileDirectory(directory: string, destination: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const input = resolve(directory, entry.name);
    const target = resolve(destination, entry.name);
    if (entry.isDirectory()) {
      await compileDirectory(input, target);
    } else if (!entry.name.endsWith('.d.ts') && /\.tsx?$/.test(entry.name)) {
      await mkdir(dirname(target), { recursive: true });
      await build({
        entryPoints: [input],
        outfile: target.replace(/\.tsx?$/, '.js'),
        bundle: extname(input) === '.tsx',
        format: 'esm',
        banner: { js: '"use strict";' },
        platform: 'browser',
        target: 'es2022',
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        sourcemap: false,
        minify: false,
      });
    }
  }
}

export async function buildExamples(output = defaultOutput) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, {
    recursive: true,
    filter: (path) => !/\.(?:tsx?|md)$/.test(path),
  });
  await compileDirectory(source, output);
  console.log(`Built independent publisher websites in ${output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const option = process.argv.indexOf('--output');
  const destination = option >= 0 ? process.argv[option + 1] : undefined;
  if (option >= 0 && !destination) throw new Error('--output requires a path');
  await buildExamples(destination ? resolve(destination) : defaultOutput);
}
