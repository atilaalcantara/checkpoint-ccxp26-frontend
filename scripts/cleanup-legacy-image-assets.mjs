import { unlink } from 'node:fs/promises';

// Only obsolete, previously generated manifest entries are removed. The
// original source files and unrelated user assets are never touched.
const legacy = [
  'branding/checkpoint-ccxp26-logo.68fb72e504.avif', 'branding/checkpoint-ccxp26-logo.c5aafe35a4.png',
  'characters/Nivel1juhDesconhecidos.ea7b6d4371.avif', 'characters/Nivel1juhDesconhecidos.8023427a5c.png',
  'characters/Nivel1atilaDesconhecidos.8b877308f8.avif', 'characters/Nivel1atilaDesconhecidos.708ba13447.png',
  'characters/Nivel2juhAmigos.e1e94bfa85.avif', 'characters/Nivel2juhAmigos.05fe9eecf2.png',
  'characters/Nivel2atilaAmigos.e5f0b0684f.avif', 'characters/Nivel2atilaAmigos.238ae2ed45.png',
  'characters/Nivel3atilajuhNamorados.1fae6f1def.avif', 'characters/Nivel3atilajuhNamorados.423053e108.png',
  'characters/Nivel4atilajuhNoivos.8ef67a1682.avif', 'characters/Nivel4atilajuhNoivos.13fbd709cc.png',
  'characters/Nivel5atilajuhCasamento.c33dff8287.avif', 'characters/Nivel5atilajuhCasamento.44e9a88d85.png',
  'mascot/korok.67f2c345c6.avif', 'mascot/korok.8db2a6950b.png',
  'icons/navigation/houseGuideBar.70f6015782.png', 'icons/navigation/cameraGuideBar.af18553a1d.png', 'icons/navigation/enqueteGuideBar.d286290cf1.png',
  'icons/sections/cameraFotos.8aeff806e3.avif', 'icons/sections/cameraFotos.81b13c787e.png',
  'icons/sections/enqueteIcon.ba20e74402.avif', 'icons/sections/enqueteIcon.add6eea61d.png',
  'demo/demo-photo-1.6df9b0e629.avif', 'demo/demo-photo-1.8bbecc4158.jpg',
  'demo/demo-photo-2.88a700fb50.avif', 'demo/demo-photo-2.fe09faaa2b.jpg',
  'demo/demo-photo-3.0c21b32a49.avif', 'demo/demo-photo-3.21ae1e45fb.jpg',
];
for (const name of legacy) {
  try { await unlink(new URL(`../public/assets/${name}`, import.meta.url)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
