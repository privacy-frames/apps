import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { buildExamples } from './build-examples.ts';
import {
  relocateCSS,
  relocateHTML,
  relocateJavaScript,
  relocateJSON,
} from './relocate.ts';

interface Archive {
  name: string;
  url: string;
  sha256: string;
}
interface Mirror {
  name: string;
  entry: string;
  origin: string;
  archive: Archive;
  additionalPaths: string[];
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function archive(value: unknown): Archive {
  if (
    !object(value) ||
    typeof value.name !== 'string' ||
    !/^[\w.-]+$/.test(value.name) ||
    typeof value.url !== 'string' ||
    !value.url.startsWith('https://github.com/privacy-frames/apps/releases/download/') ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw new Error('Invalid archive lock');
  return { name: value.name, url: value.url, sha256: value.sha256 };
}
const input: unknown = JSON.parse(await readFile('mirrors/lock.json', 'utf8'));
if (!object(input) || !Array.isArray(input.mirrors) || !Array.isArray(input.sources))
  throw new Error('Invalid publisher lock');
const mirrors: Mirror[] = input.mirrors.map((value) => {
  if (
    !object(value) ||
    typeof value.name !== 'string' ||
    !/^[a-z-]+$/.test(value.name) ||
    typeof value.entry !== 'string' ||
    typeof value.origin !== 'string'
  )
    throw new Error('Invalid mirror');
  return {
    name: value.name,
    entry: value.entry,
    origin: value.origin,
    archive: archive(value.archive),
    additionalPaths:
      Array.isArray(value.additionalPaths) &&
      value.additionalPaths.every((path: unknown) => typeof path === 'string')
        ? value.additionalPaths
        : [],
  };
});
const sources = input.sources.map(archive);
const destination = resolve('dist');
const cache = resolve('.cache');
const base = process.env.PAGES_BASE_PATH || '/apps/';
if (!/^\/[A-Za-z0-9_/-]*\/$/.test(base)) throw new Error('Invalid Pages base path');
await rm(destination, { recursive: true, force: true });
await mkdir(cache, { recursive: true });
await buildExamples(resolve('dist-examples'));
await cp(resolve('dist-examples'), destination, { recursive: true });
await writeFile(resolve(destination, '.nojekyll'), '');
const digest = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
async function obtain(item: Archive) {
  const path = resolve(cache, item.sha256);
  let body: Buffer;
  try {
    body = await readFile(path);
  } catch {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`${item.url}: HTTP ${response.status}`);
    body = Buffer.from(await response.arrayBuffer());
    if (digest(body) !== item.sha256)
      throw new Error(`Archive hash mismatch: ${item.name}`);
    await writeFile(path, body);
  }
  if (digest(body) !== item.sha256)
    throw new Error(`Cached archive hash mismatch: ${item.name}`);
  return { path, body };
}
for (const source of sources) {
  const { body } = await obtain(source);
  await mkdir(resolve(destination, 'sources'), { recursive: true });
  await writeFile(resolve(destination, 'sources', source.name), body);
}
await cp('mirrors/sources.json', resolve(destination, 'sources/sources.json'));
for (const mirror of mirrors) {
  const { path } = await obtain(mirror.archive);
  const paths = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' })
    .trim()
    .split('\n');
  if (
    paths.some(
      (path) => !path.startsWith(mirror.name + '/') || path.split('/').includes('..'),
    )
  )
    throw new Error('Unsafe archive paths');
  execFileSync('tar', [
    '-xzf',
    path,
    '--no-same-owner',
    '--no-same-permissions',
    '-C',
    destination,
  ]);
  const root = resolve(destination, mirror.name);
  const prefix = `${base}${mirror.name}/`;
  const knownPaths = new Set<string>(['/', ...mirror.additionalPaths]);
  for (const path of paths) {
    const relative = '/' + path.slice(mirror.name.length + 1);
    knownPaths.add(relative);
    const parts = relative.split('/');
    for (let i = 1; i < parts.length; i++) {
      const directory = parts.slice(0, i).join('/');
      knownPaths.add(directory);
      knownPaths.add(directory + '/');
    }
  }
  const changes: { path: string; before: string; after: string }[] = [];
  async function relocate(directory: string) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, item.name);
      if (item.isDirectory()) {
        await relocate(file);
        continue;
      }
      if (!item.isFile())
        throw new Error('Publisher archives must contain ordinary files');
      const extension = extname(file);
      const isEntry = file === resolve(root, mirror.entry);
      if (
        !isEntry &&
        !['.html', '.js', '.mjs', '.css', '.json', '.webapp'].includes(extension)
      )
        continue;
      if (['UPSTREAM-SNAPSHOT.json', 'MIRROR-NOTICE.txt'].includes(item.name)) continue;
      const original = await readFile(file);
      const text = original.toString('utf8');
      // Some upstream SPA fallback responses have asset-looking paths.
      if (!isEntry && extension !== '.html' && text.trimStart().startsWith('<')) continue;
      const entryPath = new URL(mirror.entry, mirror.origin + '/').pathname;
      let output =
        isEntry || extension === '.html'
          ? relocateHTML(text, mirror.origin, prefix, entryPath, knownPaths)
          : ['.js', '.mjs'].includes(extension)
            ? relocateJavaScript(text, mirror.origin, prefix, entryPath, knownPaths)
            : extension === '.css'
              ? relocateCSS(text, mirror.origin, prefix, entryPath, knownPaths)
              : relocateJSON(text, mirror.origin, prefix, entryPath, knownPaths);
      if (output === text) continue;
      const notice =
        'Modified by Privacy Frames: publisher URLs relocated for static subdirectory hosting; see MODIFICATIONS.json.';
      if (['.js', '.mjs', '.css'].includes(extension))
        output = `/* ${notice} */\n${output}`;
      else if (isEntry || extension === '.html') output = `<!-- ${notice} -->\n${output}`;
      else {
        const json: unknown = JSON.parse(output);
        if (object(json))
          output =
            JSON.stringify(
              { ...json, 'x-privacy-frames-modification': notice },
              null,
              2,
            ) + '\n';
      }
      await writeFile(file, output);
      changes.push({
        path: file.slice(root.length + 1),
        before: digest(original),
        after: digest(Buffer.from(output)),
      });
    }
  }
  await relocate(root);
  if (mirror.entry !== 'index.html')
    await cp(resolve(root, mirror.entry), resolve(root, 'index.html'));
  await writeFile(
    resolve(root, 'MODIFICATIONS.json'),
    JSON.stringify(
      { origin: mirror.origin, prefix, entry: mirror.entry, changes },
      null,
      2,
    ) + '\n',
  );
  console.log(mirror.name, changes.length, 'path-relocated files');
}
const external: unknown = JSON.parse(await readFile('external-apps.json', 'utf8'));
if (!Array.isArray(external)) throw new Error('Invalid external app links');
const externalLinks = external
  .map((value: unknown) => {
    if (
      !object(value) ||
      typeof value.name !== 'string' ||
      typeof value.url !== 'string' ||
      !value.url.startsWith('https://')
    )
      throw new Error('Invalid external app link');
    const escape = (text: string) =>
      text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\"', '&quot;');
    return `<li><a href=\"${escape(value.url)}\">${escape(value.name)}</a></li>`;
  })
  .join('\n');
const links = [
  'notes',
  'adversary',
  'playground',
  ...mirrors.map((mirror) => mirror.name),
]
  .map((name) => `<li><a href="./${name}/">${name}</a></li>`)
  .join('\n');
await writeFile(
  resolve(destination, 'index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Privacy Frames applications</title><style>body{font:1rem system-ui;background:#101215;color:#ddd;max-width:50rem;margin:3rem auto;padding:1rem}a{color:#a9c7ff}li{margin:.8rem 0}</style><h1>Applications</h1><p>These applications run without confinement here. Install their links at <a href="https://pf.damenh.com/">Privacy Frames</a>.</p><ul>${links}</ul><h2>External applications</h2><ul>${externalLinks}</ul><p>Mirrors retain upstream licenses and modification records. <a href="./sources/sources.json">Corresponding source archives</a>.</p></html>`,
);
console.log('Built static publisher site in dist/.');
