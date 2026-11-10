// FLIP-style transform: only the captured boxes are measured. No per-frame layout.
export function expandFrom(panel: HTMLElement, source: HTMLElement, closing = false): Animation | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const from = source.getBoundingClientRect();
  const to = panel.getBoundingClientRect();
  const origin = {
    opacity: 0,
    transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${Math.max(.08, from.width / to.width)}, ${Math.max(.08, from.height / to.height)})`,
  };
  const resting = { opacity: 1, transform: 'translate(0, 0) scale(1, 1)' };
  panel.style.transformOrigin = 'top left';
  const duration = parseFloat(getComputedStyle(panel).getPropertyValue('--duration-container')) || 280;
  const animation = panel.animate(closing ? [resting, origin] : [origin, resting], {
    duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both',
  });
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const cancel = (): void => { if (preference.matches) animation.finish(); };
  preference.addEventListener('change', cancel);
  animation.finished.finally(() => preference.removeEventListener('change', cancel)).catch(() => {});
  return animation;
}
