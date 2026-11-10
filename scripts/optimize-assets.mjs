import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { assertPSNR } from './lib/psnr.mjs';

// Retain the existing resized pixel reference and PSNR gate for AVIF.
const APPROVED_QUALITY = 70;
const MINIMUM_PSNR_DB = 35;

const original = fileURLToPath(new URL('../background.png', import.meta.url));
const originalBytes = (await stat(original)).size;
// Keep the vector source in src/ and publish a single AVIF favicon.
const favicon = await sharp(fileURLToPath(new URL('../src/assets/favicon-source.svg', import.meta.url))).resize(64, 64).avif({ lossless: true }).toBuffer();
await writeFile(new URL('../public/favicon.avif', import.meta.url), favicon);

await mkdir(new URL('../src/assets/', import.meta.url), { recursive: true });

const report = [];
for (const width of [390, 520]) {
  // The lossless PNG pixels at this width are the ground truth for both the
  // PSNR gate and the "what lossless would have cost" comparison below.
  const referencePixels = await sharp(original).resize({ width }).png().toBuffer();
  const referenceRaw = await sharp(referencePixels).ensureAlpha().raw().toBuffer();

  const [pngLossless, webpLossless, avifApproved] = await Promise.all([
    sharp(referencePixels).png({ compressionLevel: 9, palette: false }).toBuffer(),
    sharp(referencePixels).webp({ lossless: true, effort: 6 }).toBuffer(),
    sharp(referencePixels).avif({ quality: APPROVED_QUALITY, effort: 6 }).toBuffer(),
  ]);

  const approvedRaw = await sharp(avifApproved).ensureAlpha().raw().toBuffer();
  const psnr = assertPSNR(`Cenário ${width}px`, referenceRaw, approvedRaw, MINIMUM_PSNR_DB);

  const filename = `home-background-${width}.avif`;
  await writeFile(new URL(`../src/assets/${filename}`, import.meta.url), avifApproved);

  report.push({
    width,
    'PNG sem perdas': pngLossless.length,
    'WebP sem perdas (anterior)': webpLossless.length,
    [`AVIF q${APPROVED_QUALITY} (publicado)`]: avifApproved.length,
    'economia vs. WebP sem perdas': `${(100 - (avifApproved.length / webpLossless.length) * 100).toFixed(1)}%`,
    'PSNR (dB)': psnr.toFixed(1),
  });
}

console.table({ 'background.png (fonte)': { bytes: originalBytes } });
console.table(report);
console.log(
  `Publicado como AVIF com perdas (qualidade ${APPROVED_QUALITY}), ` +
  `e gate automático de PSNR (mínimo ${MINIMUM_PSNR_DB}dB). Ver ASSET_OPTIMIZATION.md.`
);
