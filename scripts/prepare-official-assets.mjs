import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { computePSNR, assertVisiblePixelsMatch } from './lib/psnr.mjs';
import { writeHashed } from './lib/hashed-output.mjs';

// AVIF q88 for illustrated portraits, with a composited quality gate and a
// bounded alpha difference. The frame and masks remain strictly lossless.
const entries = [
  ['logo', 'checkpoint-ccxp26-logo.png', 'branding', 'portrait', { width: 720, kernel: 'lanczos3' }],
  ['juh', 'Nivel1juhDesconhecidos.png', 'characters', 'portrait', { height: 448, kernel: 'nearest' }],
  ['atila', 'Nivel1atilaDesconhecidos.png', 'characters', 'portrait', { height: 448, kernel: 'nearest' }],
  ['korok', 'korok.png', 'mascot', 'portrait', { height: 260, kernel: 'nearest' }],
  ['korokBefore', 'korokRegandoMuda.png', 'mascot', 'portrait', { height: 564, kernel: 'nearest' }],
  ['korokPaused', 'KorokMartelandoPlaca.png', 'mascot', 'portrait', { height: 564, kernel: 'nearest' }],
  ['korokEnded', 'KorokPorDoSol.png', 'mascot', 'portrait', { height: 564, kernel: 'nearest' }],
  ['house', 'houseGuideBar.png', 'icons/navigation', 'mask', { height: 128, kernel: 'lanczos3' }],
  ['camera', 'cameraGuideBar.png', 'icons/navigation', 'mask', { height: 128, kernel: 'lanczos3' }],
  ['poll', 'enqueteGuideBar.png', 'icons/navigation', 'mask', { height: 128, kernel: 'lanczos3' }],
  ['cameraFotos', 'cameraFotos.png', 'icons/sections', 'portrait', { height: 220, kernel: 'lanczos3' }],
  ['enqueteIcon', 'enqueteIcon.png', 'icons/sections', 'portrait', { height: 220, kernel: 'lanczos3' }],
  ['polaroidFrame', 'molduraPolaroidUnica.png', 'frames', 'frame', { width: 420, kernel: 'lanczos3' }],
];
const inspectOnly = process.argv.includes('--inspect');
const exists = async path => access(path).then(() => true, () => false);
const manifest = {};
const report = [];

for (const [key, name, directory, kind, resize] of entries) {
  const root = new URL(`../${name}`, import.meta.url);
  const archived = new URL(`../source-assets/official/${name}`, import.meta.url);
  const levels = new URL(`../PersonagensENiveis/${name}`, import.meta.url);
  const source = await exists(levels) ? levels : await exists(root) ? root : archived;
  const original = await readFile(source);
  const metadata = await sharp(original).metadata();
  if (metadata.format !== 'png' || !metadata.hasAlpha) throw new Error(`${name}: é necessário PNG com alpha.`);
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 8) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error(`${name}: área útil vazia.`);
  left = Math.max(0, left - 8); top = Math.max(0, top - 8);
  right = Math.min(info.width - 1, right + 8); bottom = Math.min(info.height - 1, bottom + 8);
  const region = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const pipeline = sharp(original);
  if (kind !== 'frame') pipeline.extract(region);
  const prepared = await pipeline.resize({ ...resize, withoutEnlargement: true }).png().toBuffer();
  const reference = await sharp(prepared).ensureAlpha().raw().toBuffer();
  const output = await sharp(prepared).metadata();
  let avif;
  let quality = 'lossless';
  let psnr = Infinity;
  let alphaDelta = 0;
  if (kind === 'portrait') {
    const compositedReference = await sharp(prepared).flatten({ background: '#fff7ef' }).raw().toBuffer();
    for (const candidateQuality of [88, 95, 100]) {
      const candidate = await sharp(prepared).avif({ quality: candidateQuality, effort: 6 }).toBuffer();
      const pixels = await sharp(candidate).ensureAlpha().raw().toBuffer();
      let alphaMaxDiff = 0;
      for (let i = 3; i < reference.length; i += 4) {
        const diff = Math.abs(reference[i] - pixels[i]);
        alphaMaxDiff = Math.max(alphaMaxDiff, diff);
      }
      const compositedCandidate = await sharp(candidate).flatten({ background: '#fff7ef' }).raw().toBuffer();
      const score = computePSNR(compositedReference, compositedCandidate);
      if (alphaMaxDiff <= 6 && score >= 40) { avif = candidate; quality = String(candidateQuality); psnr = score; alphaDelta = alphaMaxDiff; break; }
    }
  }
  if (!avif) {
    avif = await sharp(prepared).avif({ lossless: true, effort: 6 }).toBuffer();
    assertVisiblePixelsMatch(name, reference, await sharp(avif).ensureAlpha().raw().toBuffer());
  }
  report.push({ name, dimensions: `${output.width}×${output.height}`, bytes: avif.length, quality, psnr: Number.isFinite(psnr) ? psnr.toFixed(1) : 'lossless', alphaMax: alphaDelta });
  if (inspectOnly) continue;
  const destination = new URL(`../public/assets/${directory}/`, import.meta.url);
  await mkdir(destination, { recursive: true });
  if (source.href === root.href && await exists(archived) && !(await readFile(archived)).equals(original)) throw new Error(`Original arquivado diferente: ${name}`);
  const filename = await writeHashed(destination, name.replace(/\.png$/, ''), 'avif', avif);
  if (source.href === root.href && !await exists(archived)) { await mkdir(new URL('../source-assets/official/', import.meta.url), { recursive: true }); await rename(root, archived); }
  const entry = { width: output.width, height: output.height };
  if (kind === 'portrait') entry.avif = `/assets/${directory}/${filename}`;
  else entry.src = `/assets/${directory}/${filename}`;
  manifest[key] = entry;
}
if (!inspectOnly) await writeFile(new URL('../src/assets/official-assets.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
console.table(report);
