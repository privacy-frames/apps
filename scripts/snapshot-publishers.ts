/** Evaluation publisher snapshots; never included in the trusted host build. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const directory = resolve(
  process.env.PUBLISHER_SNAPSHOT_DIRECTORY || '/tmp/pf-corpus-publishers/snapshots',
);
const publishers = [
  {
    id: 'squoosh',
    entry: 'https://squoosh.app/',
    license: 'Apache-2.0',
    repository: 'GoogleChromeLabs/squoosh',
    ref: 'dev',
  },
  {
    id: 'excalidraw',
    entry: 'https://excalidraw.com/',
    license: 'MIT',
    repository: 'excalidraw/excalidraw',
    ref: 'master',
  },
  {
    id: 'stackedit',
    entry: 'https://stackedit.io/app',
    license: 'Apache-2.0',
    repository: 'benweet/stackedit',
    ref: 'master',
  },
];
const selected = publishers.filter(
  (p) => !process.env.PUBLISHER || p.id === process.env.PUBLISHER,
);
for (const publisher of selected) {
  const origin = new URL(publisher.entry).origin;
  const pending = [publisher.entry, `${origin}/sw.js`, `${origin}/manifest.json`];
  const visited = new Set<string>();
  const files: {
    url: string;
    path: string;
    bytes: number;
    sha256: string;
    contentType: string;
  }[] = [];
  const failures: { url: string; reason: string }[] = [];
  let bytes = 0;
  while (pending.length) {
    const batch = pending.splice(0, 8).filter((url) => {
      if (visited.has(url)) return false;
      visited.add(url);
      return true;
    });
    await Promise.all(
      batch.map(async (url) => {
        try {
          if (visited.size > 2000 || bytes > 250 * 1024 ** 2)
            throw new Error('Snapshot budget exceeded');
          const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (new URL(response.url).origin !== origin)
            throw new Error('Cross-origin redirect');
          const body = Buffer.from(await response.arrayBuffer());
          bytes += body.length;
          const parsed = new URL(url);
          const contentType = response.headers.get('content-type') || '';
          let path = parsed.pathname.replace(/^\//, '');
          if (!path || path.endsWith('/')) path += 'index.html';
          if (parsed.search) throw new Error('Snapshot query needs distinct route');
          const target = resolve(directory, publisher.id, path);
          if (!target.startsWith(resolve(directory, publisher.id) + '/'))
            throw new Error('Unsafe path');
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, body);
          files.push({
            url,
            path,
            bytes: body.length,
            sha256: createHash('sha256').update(body).digest('hex'),
            contentType,
          });
          if (/javascript|text\/|json/.test(contentType)) {
            const text = body.toString('utf8');
            const references = [
              ...text.matchAll(
                /["'`]([^"'`\s<>\\]+\.(?:m?js|css|wasm|json|png|jpe?g|gif|svg|ico|woff2?|ttf|webp)(?:\?[^"'`\s<>\\]*)?)["'`]/gi,
              ),
              ...text.matchAll(
                /(?:src|href)\s*=\s*([^\s"'<>]+\.(?:m?js|css|json|png|ico))/gi,
              ),
              ...text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi),
            ];
            const scriptBases = /html/.test(contentType)
              ? [...text.matchAll(/\b(?:data-)?src=["']([^"']+\.js)["']/g)].map(
                  (match) => new URL(match[1], url).href,
                )
              : [url];
            for (const match of text.matchAll(
              /["'`](\.\/[^"'`\s<>\\]+-[a-f0-9]{8})["'`]/gi,
            )) {
              for (const base of [url, ...scriptBases]) {
                const next = new URL(match[1] + '.js', base);
                if (next.origin === origin && !visited.has(next.href))
                  pending.push(next.href);
              }
            }
            for (const match of references) {
              try {
                if (/^(?:data:|blob:)/i.test(match[1])) continue;
                const next = new URL(match[1], url);
                next.hash = '';
                if (next.origin === origin && !visited.has(next.href))
                  pending.push(next.href);
              } catch {
                /* Not a URL literal. */
              }
            }
          }
        } catch (error) {
          failures.push({
            url,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  }
  const licenseURL = `https://raw.githubusercontent.com/${publisher.repository}/${publisher.ref}/LICENSE`;
  const license = await fetch(licenseURL);
  if (!license.ok) throw new Error(`Missing license ${licenseURL}`);
  await writeFile(
    resolve(directory, publisher.id, 'UPSTREAM-LICENSE.txt'),
    await license.text(),
  );
  for (const name of ['NOTICE', 'NOTICE.txt', 'LICENSES.txt', 'LICENSES.md']) {
    const response = await fetch(
      `https://raw.githubusercontent.com/${publisher.repository}/${publisher.ref}/${name}`,
    );
    if (response.ok)
      await writeFile(
        resolve(directory, publisher.id, `UPSTREAM-${name}`),
        await response.text(),
      );
  }
  const manifest = {
    captured: new Date().toISOString(),
    ...publisher,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    downloadedBytes: bytes,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    failures,
  };
  await writeFile(
    resolve(directory, `${publisher.id}-snapshot.json`),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(
    publisher.id,
    files.length,
    bytes,
    'bytes;',
    failures.length,
    'unavailable references',
  );
}
