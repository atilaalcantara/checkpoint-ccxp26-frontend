// Pure-JS PSNR (Peak Signal-to-Noise Ratio) so the optimization pipeline has
// no runtime dependency on ImageMagick or any other system binary — only
// sharp, already a devDependency, is required to reproduce these builds.
//
// Used strictly as an automated regression gate for *pre-approved* lossy
// candidates (AVIF/WebP quality settings chosen after manual visual review).
// It is not a substitute for the visual review itself.
export function computePSNR(referenceRaw, candidateRaw) {
  if (referenceRaw.length !== candidateRaw.length) {
    throw new Error(`Buffers de tamanhos diferentes para PSNR (${referenceRaw.length} vs ${candidateRaw.length}).`);
  }
  let sumSquaredError = 0;
  for (let i = 0; i < referenceRaw.length; i++) {
    const diff = referenceRaw[i] - candidateRaw[i];
    sumSquaredError += diff * diff;
  }
  const meanSquaredError = sumSquaredError / referenceRaw.length;
  if (meanSquaredError === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / meanSquaredError);
}

/** Throws if a pre-approved lossy candidate falls below the visually-vetted PSNR floor. */
export function assertPSNR(label, referenceRaw, candidateRaw, minimumDb) {
  const psnr = computePSNR(referenceRaw, candidateRaw);
  if (psnr < minimumDb) {
    throw new Error(
      `${label}: PSNR caiu para ${psnr.toFixed(1)}dB (mínimo aprovado: ${minimumDb}dB). ` +
      'A fonte mudou de forma relevante: refaça a inspeção visual antes de aceitar uma nova configuração com perdas.'
    );
  }
  return psnr;
}

/**
 * Pixel-exact comparison for "lossless" RGBA candidates, where alpha always
 * must match exactly, but RGB is only compared where the reference pixel is
 * actually visible (alpha > 0). Different lossless encoders (e.g. PNG vs
 * WebP) may legitimately store different "don't care" RGB under alpha = 0 —
 * that is not a transparency defect, since those bytes are never rendered.
 */
export function assertVisiblePixelsMatch(label, referenceRaw, candidateRaw) {
  if (referenceRaw.length !== candidateRaw.length) {
    throw new Error(`${label}: buffers de tamanhos diferentes (${referenceRaw.length} vs ${candidateRaw.length}).`);
  }
  for (let i = 0; i < referenceRaw.length; i += 4) {
    const referenceAlpha = referenceRaw[i + 3];
    if (referenceAlpha !== candidateRaw[i + 3]) {
      throw new Error(`${label}: alpha diferente no pixel ${i / 4} (${referenceAlpha} vs ${candidateRaw[i + 3]}).`);
    }
    if (referenceAlpha === 0) continue;
    for (let channel = 0; channel < 3; channel++) {
      if (referenceRaw[i + channel] !== candidateRaw[i + channel]) {
        throw new Error(`${label}: pixel visível ${i / 4} difere no canal ${channel}.`);
      }
    }
  }
}
