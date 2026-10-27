import { label } from '../wasm-label.js';
export async function compute() {
  const response = await fetch('./answer.wasm');
  const { instance } = await WebAssembly.instantiateStreaming(response, {});
  const answer = instance.exports.answer as () => number;
  return label(answer());
}
