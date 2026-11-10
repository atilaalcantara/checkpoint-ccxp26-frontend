import { unlink } from 'node:fs/promises';

// Explicit list of generated WebP delivery assets from the previous pipeline.
// Source images and unrelated assets are never removed.
const generated = [
  '../src/assets/home-background-390.webp', '../src/assets/home-background-520.webp', '../public/favicon.webp',
  '../public/assets/branding/checkpoint-ccxp26-logo.a4a89f1e0d.webp',
  '../public/assets/characters/Nivel1juhDesconhecidos.69917af9a4.webp', '../public/assets/characters/Nivel1atilaDesconhecidos.2c59ba1934.webp',
  '../public/assets/characters/Nivel2juhAmigos.01f0f92b05.webp', '../public/assets/characters/Nivel2atilaAmigos.fa028e097b.webp',
  '../public/assets/characters/Nivel3atilajuhNamorados.b8716773f3.webp', '../public/assets/characters/Nivel4atilajuhNoivos.a2a071f535.webp',
  '../public/assets/characters/Nivel5atilajuhCasamento.6620c9ace4.webp', '../public/assets/mascot/korok.c4d5066372.webp',
  '../public/assets/icons/navigation/houseGuideBar.81c27cdf84.webp', '../public/assets/icons/navigation/cameraGuideBar.1cf896554f.webp',
  '../public/assets/icons/navigation/enqueteGuideBar.0633d8d325.webp', '../public/assets/icons/sections/cameraFotos.9be07c09d3.webp',
  '../public/assets/icons/sections/enqueteIcon.aadd14eedf.webp', '../public/assets/frames/molduraPolaroidUnica.1cc2d7f4ca.webp',
  '../public/assets/demo/demo-photo-1.f2c2eda099.webp', '../public/assets/demo/demo-photo-2.1739ec7fde.webp', '../public/assets/demo/demo-photo-3.1b4bd2b99c.webp',
];
for (const path of generated) {
  try { await unlink(new URL(path, import.meta.url)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
