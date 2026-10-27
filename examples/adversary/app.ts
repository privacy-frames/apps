'use strict';
if (window.privacyHost)
  document.querySelector('#mode')!.textContent = 'Installed · network isolated';
const probes: Record<string, () => unknown | Promise<unknown>> = {
  'createElement iframe': () => {
    const n = document.createElement('iframe');
    document.body.append(n);
    return !!(n as HTMLIFrameElement).contentWindow;
  },
  'createElementNS iframe': () => {
    const n = document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe');
    document.body.append(n);
    return !!(n as HTMLIFrameElement).contentWindow;
  },
  'innerHTML iframe': () => {
    const n = document.createElement('div');
    document.body.append(n);
    n.innerHTML = '<iframe></iframe>';
    return !!(n.firstChild as HTMLIFrameElement).contentWindow;
  },
  'insertAdjacentHTML iframe': () => {
    const n = document.createElement('div');
    document.body.append(n);
    n.insertAdjacentHTML('beforeend', '<iframe></iframe>');
    return !!(n.firstChild as HTMLIFrameElement).contentWindow;
  },
  'outerHTML iframe': () => {
    const n = document.createElement('div');
    document.body.append(n);
    n.outerHTML = '<iframe></iframe>';
    return true;
  },
  'template parser': () => {
    const t = document.createElement('template');
    t.innerHTML = '<iframe></iframe>';
    const fragment = t.content.cloneNode(true),
      frame = fragment.firstChild;
    document.body.append(fragment);
    return !!(frame as HTMLIFrameElement).contentWindow;
  },
  'Shadow DOM parser': () => {
    const n = document.createElement('div');
    document.body.append(n);
    const root = n.attachShadow({ mode: 'closed' });
    root.innerHTML = '<iframe></iframe>';
    return !!(root.firstChild as HTMLIFrameElement).contentWindow;
  },
  'Range parser': () => {
    const r = document.createRange();
    r.selectNodeContents(document.body);
    const fragment = r.createContextualFragment('<iframe></iframe>'),
      frame = fragment.firstChild;
    document.body.append(fragment);
    return !!(frame as HTMLIFrameElement).contentWindow;
  },
  'DOMParser import': () => {
    const d = new DOMParser().parseFromString('<iframe></iframe>', 'text/html');
    const frame = document.importNode(d.body.firstChild!, true);
    document.body.append(frame);
    return !!(frame as HTMLIFrameElement).contentWindow;
  },
  'document creation': () => document.implementation.createHTMLDocument('fresh'),
  'document.write': () => {
    document.write('<iframe></iframe>');
    return true;
  },
  'Audio worklet': async () => {
    const audio = new AudioContext();
    try {
      await audio.audioWorklet.addModule('./worklet.js');
      return true;
    } finally {
      await audio.close();
    }
  },
  Worker: () => new Worker('./app.js'),
  SharedWorker: () => new SharedWorker('./app.js'),
  WebSocket: () => new WebSocket('ws://127.0.0.1:4216/socket'),
  WebRTC: () => new RTCPeerConnection(),
  'window.open': () => window.open('about:blank'),
  'service worker authority': () => navigator.serviceWorker,
  'Native storage prototype recovery': () =>
    Storage.prototype.getItem.call(localStorage, 'manager-secret'),
  'Storage access handle': () =>
    Reflect.apply(document.requestStorageAccess, document, [
      { localStorage: true, indexedDB: true },
    ]),
  'Remote speech service': () =>
    speechSynthesis.speak(new SpeechSynthesisUtterance('synthetic probe')),
  'Media artwork URL': () => {
    navigator.mediaSession.metadata = new MediaMetadata({
      artwork: [{ src: 'http://127.0.0.1:4216/artwork?value=private-marker' }],
    });
  },
  'Existing script property mutation': () => {
    document.querySelector('script')!.src =
      'http://127.0.0.1:4216/script?value=private-marker';
  },
  'history identity spoof': () => {
    history.pushState({}, '', '../../bridge.html');
    return true;
  },
  'history replace spoof': () => {
    history.replaceState({}, '', '../../bridge.html');
    return true;
  },
  'SVG parser mismatch': () => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.append(n);
    n.innerHTML = '<style><iframe></iframe></style>';
    return true;
  },
  setHTMLUnsafe: () => {
    const n = document.createElement('div');
    n.setHTMLUnsafe('<iframe></iframe>');
    document.body.append(n);
    return true;
  },
  'document execCommand': () => {
    document.execCommand('insertHTML', false, '<iframe></iframe>');
    return true;
  },
  'history traversal': () => {
    history.go(-1);
    return true;
  },
  'custom built-in': () => {
    customElements.define('hostile-frame', class extends HTMLIFrameElement {}, {
      extends: 'iframe',
    });
    return true;
  },
  eval: () => eval('1 + 1'),
  'Function constructor': () => new Function('return 2')(),
  'prototype tampering': () => {
    Array.prototype.map = () => [];
    return true;
  },
};
window.boundaryProbes = Object.freeze(probes);
document.querySelector('#run')!.addEventListener('click', async () => {
  const body = document.querySelector('#results')!;
  body.replaceChildren();
  let blocked = 0;
  for (const [name, fn] of Object.entries(probes)) {
    const row = document.createElement('tr'),
      label = document.createElement('td'),
      result = document.createElement('td');
    label.textContent = name;
    if (
      !window.privacyHost &&
      [
        'document.write',
        'history traversal',
        'history identity spoof',
        'history replace spoof',
      ].includes(name)
    ) {
      result.textContent = 'Use isolated control fixture';
      row.append(label, result);
      body.append(row);
      continue;
    }
    try {
      const value = await fn();
      result.textContent = value === null ? 'Browser refused' : 'Allowed / available';
    } catch (error) {
      result.textContent = `Blocked: ${error instanceof Error ? error.name : 'Error'}`;
      blocked++;
    }
    row.append(label, result);
    body.append(row);
  }
  document.querySelector('#status')!.textContent =
    `${blocked} of ${Object.keys(probes).length} checks refused. See the report for scope and controls.`;
});

// Local receiver for automated controls; publisher-origin paths also demonstrate HTTP denial.
document.querySelector('#network')!.addEventListener('click', async () => {
  const marker = encodeURIComponent(
    document.querySelector<HTMLInputElement>('#diagnostic')!.value,
  );
  const publisher = window.privacyHost?.publisher || location.origin;
  const sink = publisher.startsWith('http://127.0.0.1:')
    ? 'http://127.0.0.1:4216'
    : publisher;
  const receiver = sink + '/disclosure?value=' + marker;
  const pending = [];
  pending.push(
    fetch(receiver + '&route=fetch').then(
      () => false,
      () => true,
    ),
  );
  pending.push(
    new Promise((resolve) => {
      const x = new XMLHttpRequest();
      x.open('POST', receiver + '&route=xhr');
      x.onload = () => resolve(false);
      x.onerror = x.onabort = x.ontimeout = () => resolve(true);
      x.timeout = 2000;
      x.send(marker);
    }),
  );
  const image = new Image();
  image.src = receiver + '&route=image';
  document.body.append(image);
  const style = document.createElement('style');
  style.textContent = 'body{background-image:url("' + receiver + '&route=css")}';
  document.head.append(style);
  const anchor = document.createElement('a');
  anchor.href = receiver + '&route=navigation';
  anchor.ping = receiver + '&route=ping';
  anchor.textContent = 'Diagnostic link';
  document.body.append(anchor);
  try {
    anchor.click();
  } catch {}
  const form = document.createElement('form');
  form.action = receiver + '&route=form';
  document.body.append(form);
  try {
    form.submit();
  } catch {}
  try {
    new WebSocket(sink.replace(/^http/, 'ws') + '/socket?value=' + marker);
  } catch {}
  try {
    new RTCPeerConnection();
  } catch {}
  // Programmatic navigation uses the same browser event boundary as a normal link.
  const outcomes = await Promise.all(pending);
  try {
    location.href = receiver + '&route=location';
  } catch {}
  document.querySelector('#status')!.textContent = outcomes.every(Boolean)
    ? 'Fetch and XHR rejected. Inspect the receiver for all attempted routes.'
    : 'An unrestricted network operation succeeded.';
});
