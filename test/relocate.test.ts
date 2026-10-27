import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { relocateJavaScript, relocateHTML } from '../scripts/relocate.ts';

test('relocation preserves string delimiters and regex while mapping asset URLs', () => {
  const source = String.raw`const loader = {}; loader.p = '/';
    const parts = ['a', 'b'].join('/');
    const regexp = /a\/b/;
    ({ path: '/assets/main.js', loader: loader.p, parts, match: regexp.test('a/b') });`;
  const result: unknown = runInNewContext(
    relocateJavaScript(source, 'https://publisher.invalid', '/apps/demo/'),
  );
  assert(result && typeof result === 'object');
  assert.equal(Reflect.get(result, 'path'), '/apps/demo/assets/main.js');
  assert.equal(Reflect.get(result, 'loader'), '/apps/demo/');
  assert.equal(Reflect.get(result, 'parts'), 'a/b');
  assert.equal(Reflect.get(result, 'match'), true);
});

test('inline script and HTML asset URLs relocate together', () => {
  const result = relocateHTML(
    '<!doctype html><script>const image = "/picture.png";</script><img src="/picture.png">',
    'https://publisher.invalid',
    '/apps/demo/',
  );
  assert(result.includes('const image = "/apps/demo/picture.png"'));
  assert(result.includes('src="/apps/demo/picture.png"'));
});

test('directory-join suffixes are preserved when relocating known publisher resources', () => {
  const source = `const resources = 'resources'; ({ suffix: resources + '/dia', asset: '/resources/picture.png' });`;
  const result: unknown = runInNewContext(
    relocateJavaScript(
      source,
      'https://publisher.invalid',
      '/apps/demo/',
      '/',
      new Set(['/resources/picture.png']),
    ),
  );
  assert(result && typeof result === 'object');
  assert.equal(Reflect.get(result, 'suffix'), 'resources/dia');
  assert.equal(Reflect.get(result, 'asset'), '/apps/demo/resources/picture.png');
});
