import { mkdir, readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { writeHashed } from './lib/hashed-output.mjs';

// DEMO-ONLY placeholder content. There is no backend yet (see
// ASSET_OPTIMIZATION.md / design.markdown §4.2): these are free-license
// stock photos (Unsplash License), not real visitor uploads, used solely so
// the three-Polaroid "fan" composition in RecentPhotos.astro can be reviewed
// and tested against the approved prototype. Replace this entire script's
// output with the real API response once the gallery backend exists —
// nothing here is meant to ship as real product content.
//
// Thumbnail size approximates what a future backend would deliver: roughly
// 2x the Polaroid window's maximum measured CSS size, pre-cropped to the
// window's aspect ratio server-side (cover-fit), so the browser never
// downloads more than the frame can ever show. The frame itself is prepared
// and published separately (prepare-official-assets.mjs) and stays
// decoupled from whatever photo ends up behind it.
const THUMBNAIL = { width: 360, height: 330 };
const AVIF_QUALITY = 68;

const sourceDir = new URL('../source-assets/demo/', import.meta.url);
const destDir = new URL('../public/assets/demo/', import.meta.url);
await mkdir(destDir, { recursive: true });

const files = (await readdir(sourceDir)).filter(f => /\.(jpe?g|png)$/i.test(f)).sort();
if (!files.length) {
  console.log('Nenhuma foto de demonstração em source-assets/demo/ — nada a fazer.');
  process.exit(0);
}

const manifest = {};
const report = [];
for (const file of files) {
  const original = await readFile(new URL(file, sourceDir));
  const base = sharp(original).resize({ ...THUMBNAIL, fit: 'cover', position: 'attention' });
  const avif = await base.avif({ quality: AVIF_QUALITY, effort: 6 }).toBuffer();
  const stem = file.replace(/\.(jpe?g|png)$/i, '');
  const avifFile = await writeHashed(destDir, stem, 'avif', avif);
  manifest[stem] = {
    width: THUMBNAIL.width,
    height: THUMBNAIL.height,
    avif: `/assets/demo/${avifFile}`,
  };
  report.push({ file, originalBytes: original.length, avif: avif.length });
}

await import('node:fs/promises').then(fs =>
  fs.writeFile(new URL('../src/assets/demo-photos.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`)
);
console.table(report);
console.log('Miniaturas de demonstração publicadas (placeholder, não são fotos reais de visitantes).');
