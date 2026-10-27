'use strict';
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!,
  ctx = canvas.getContext('2d', { willReadFrequently: true })!,
  statusElement = document.querySelector('#status')!;
if (window.privacyHost)
  document.querySelector('#mode')!.textContent = 'Installed · network isolated';
function sample() {
  canvas.width = 480;
  canvas.height = 280;
  const gradient = ctx.createLinearGradient(0, 0, 480, 280);
  gradient.addColorStop(0, '#adc58d');
  gradient.addColorStop(1, '#234e3a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 480, 280);
  ctx.fillStyle = '#f7f4d9';
  ctx.beginPath();
  ctx.arc(330, 90, 42, 0, Math.PI * 2);
  ctx.fill();
  statusElement.textContent = '480 × 280 pixels available to this application.';
}
document.querySelector('#sample')!.addEventListener('click', sample);
document.querySelector('#file')!.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const image = await createImageBitmap(file);
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    image.close();
    statusElement.textContent = `${canvas.width} × ${canvas.height} private pixels loaded locally.`;
  } catch {
    statusElement.textContent = 'The image could not be decoded.';
  }
});
function edit(gray: boolean) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    if (gray) {
      const y = Math.round(
        0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2],
      );
      image.data[i] = image.data[i + 1] = image.data[i + 2] = y;
    } else for (let j = 0; j < 3; j++) image.data[i + j] = 255 - image.data[i + j];
  }
  ctx.putImageData(image, 0, 0);
  statusElement.textContent = 'Pixels transformed locally. Nothing sent.';
}
document.querySelector('#invert')!.addEventListener('click', () => edit(false));
document.querySelector('#gray')!.addEventListener('click', () => edit(true));
sample();
