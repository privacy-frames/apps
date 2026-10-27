import { tokenizer } from 'acorn';
import { parse, serialize, type DefaultTreeAdapterTypes as Tree } from 'parse5';

export function relocateURL(
  value: string,
  origin: string,
  prefix: string,
  entryPath = '/',
  paths?: ReadonlySet<string>,
) {
  if (entryPath !== '/' && [entryPath, origin + entryPath].includes(value)) return prefix;
  const candidate = value.startsWith(origin + '/') ? value.slice(origin.length) : value;
  const pathname = candidate.split(/[?#]/)[0];
  if (paths && !paths.has(pathname)) return value;
  if (value.startsWith(origin + '/')) return prefix + value.slice(origin.length + 1);
  if (/^\/[A-Za-z0-9_.~%/-]+(?:[?#][^\s]*)?$/.test(value) && !value.startsWith('//'))
    return prefix + value.slice(1);
  return value;
}

export function relocateJavaScript(
  text: string,
  origin: string,
  prefix: string,
  entryPath = '/',
  paths?: ReadonlySet<string>,
) {
  const tokens = tokenizer(text, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowHashBang: true,
  });
  const changes: { start: number; end: number; text: string }[] = [];
  for (;;) {
    const token = tokens.getToken();
    if (token.type.label === 'eof') break;
    const tokenValue: unknown = Reflect.get(token, 'value');
    if (
      !['string', 'template'].includes(token.type.label) ||
      typeof tokenValue !== 'string'
    )
      continue;
    let value = relocateURL(tokenValue, origin, prefix, entryPath, paths);
    // Webpack's bootstrap public path is a directory, not a slash delimiter.
    if (
      tokenValue === '/' &&
      /\.p\s*=\s*$/.test(text.slice(Math.max(0, token.start - 25), token.start))
    )
      value = prefix;
    if (value === tokenValue) continue;
    const replacement =
      token.type.label === 'template'
        ? JSON.stringify(value).slice(1, -1).replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
        : JSON.stringify(value);
    changes.push({ start: token.start, end: token.end, text: replacement });
  }
  for (const change of changes.reverse())
    text = text.slice(0, change.start) + change.text + text.slice(change.end);
  return text;
}

export function relocateCSS(
  text: string,
  origin: string,
  prefix: string,
  entryPath = '/',
  paths?: ReadonlySet<string>,
) {
  return text.replace(
    /url\(\s*(["']?)([^"'\s)]+)\1\s*\)/gi,
    (whole, _quote: string, value: string) => {
      const relocated = relocateURL(value, origin, prefix, entryPath, paths);
      return value === relocated ? whole : `url(${JSON.stringify(relocated)})`;
    },
  );
}

export function relocateHTML(
  text: string,
  origin: string,
  prefix: string,
  entryPath = '/',
  paths?: ReadonlySet<string>,
) {
  const ast = parse(text);
  function walk(node: Tree.Node) {
    if ('tagName' in node) {
      for (const attribute of node.attrs) {
        if (['href', 'src', 'data-src', 'action', 'poster'].includes(attribute.name))
          attribute.value = relocateURL(
            attribute.value,
            origin,
            prefix,
            entryPath,
            paths,
          );
        if (attribute.name === 'style')
          attribute.value = relocateCSS(
            attribute.value,
            origin,
            prefix,
            entryPath,
            paths,
          );
      }
      if (node.tagName === 'script' || node.tagName === 'style') {
        const type =
          node.attrs.find((attribute) => attribute.name === 'type')?.value || '';
        for (const child of node.childNodes) {
          if (!('value' in child)) continue;
          if (node.tagName === 'style')
            child.value = relocateCSS(child.value, origin, prefix, entryPath, paths);
          else if (
            ['', 'module', 'text/javascript', 'application/javascript'].includes(type)
          )
            child.value = relocateJavaScript(
              child.value,
              origin,
              prefix,
              entryPath,
              paths,
            );
        }
      }
    }
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
    if ('content' in node) walk(node.content as Tree.DocumentFragment);
  }
  walk(ast);
  return serialize(ast);
}

export function relocateJSON(
  text: string,
  origin: string,
  prefix: string,
  entryPath = '/',
  paths?: ReadonlySet<string>,
) {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return text;
    throw error;
  }
  function visit(value: unknown): unknown {
    if (typeof value === 'string')
      return value === '/'
        ? prefix
        : relocateURL(value, origin, prefix, entryPath, paths);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, visit(child)]),
      );
    return value;
  }
  return JSON.stringify(visit(input), null, 2) + '\n';
}
