'use strict';
const $ = <T extends HTMLElement = HTMLTextAreaElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const publisher = window.privacyHost?.publisher || location.origin;
if (window.privacyHost) $('#mode').textContent = 'Installed · network isolated';
$('#html').value =
  '<h2>Private input</h2>\n<input id="secret" value="demonstration-only">\n<p id="result">Click Run to try sending this value.</p>';
$('#css').value =
  ':host { color: #dce2eb; font: 14px system-ui; }\ninput { padding: 10px; background: #242d3b; color: white; border: 1px solid #53647e; border-radius: 4px; }';
const sink = publisher.startsWith('http://127.0.0.1:')
  ? 'http://127.0.0.1:4216'
  : publisher;
$('#javascript').value = `const secret = preview.querySelector('#secret').value;
const destination = ${JSON.stringify(sink + '/disclosure')};
log('Trying to send:', secret);
try {
  const response = await fetch(destination + '?secret=' + encodeURIComponent(secret));
  log('NETWORK REACHED: HTTP', response.status);
} catch (error) {
  log('BLOCKED:', error.name);
}
preview.querySelector('#result').textContent = 'Attempt finished.';`;
const preview = $('#preview').attachShadow({ mode: 'open' });
// Render the initial input without executing the test script.
let lastHTML: string;
let style: HTMLStyleElement;
function render() {
  if ($('#html').value !== lastHTML) {
    preview.innerHTML = $('#html').value;
    lastHTML = $('#html').value;
    style = document.createElement('style');
    preview.append(style);
  }
  style.textContent = $('#css').value;
}
render();
$('#run').addEventListener('click', async () => {
  const output = $('#output');
  output.textContent = '';
  const log = (...values: unknown[]) => {
    output.textContent +=
      values.map((v) => (typeof v === 'string' ? v : String(v))).join(' ') + '\n';
  };
  let moduleURL: string | undefined;
  try {
    render();
    const source =
      'export default async function(preview, log) {\n' + $('#javascript').value + '\n}';
    moduleURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const program = await import(moduleURL);
    await program.default(preview, log);
    if (!output.textContent) log('Completed.');
  } catch (error) {
    log(
      'ERROR:',
      error instanceof Error ? error.name : 'Error',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    if (moduleURL) URL.revokeObjectURL(moduleURL);
  }
});
