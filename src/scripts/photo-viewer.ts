export interface ViewerPhoto { src: string; alt: string }

const dialog = document.querySelector<HTMLDialogElement>('[data-photo-viewer]');
const image = dialog?.querySelector<HTMLImageElement>('[data-photo-viewer-image]');
const card = dialog?.querySelector<HTMLElement>('[data-photo-viewer-card]');
const swipe = dialog?.querySelector<HTMLElement>('[data-photo-viewer-swipe]');
const position = dialog?.querySelector<HTMLElement>('[data-photo-viewer-position]');
const previous = dialog?.querySelector<HTMLButtonElement>('[data-photo-viewer-prev]');
const next = dialog?.querySelector<HTMLButtonElement>('[data-photo-viewer-next]');
const hint = dialog?.querySelector<HTMLElement>('[data-photo-viewer-hint]');
const close = dialog?.querySelector<HTMLButtonElement>('[data-photo-viewer-close]');
let photos: ViewerPhoto[] = [];
let index = 0;
let opener: HTMLElement | null = null;
let start: { id: number; x: number; y: number } | null = null;

function render(direction = 0) {
  if (!image || !position || !previous || !next || !hint || !card || !photos[index]) return;
  image.src = photos[index].src; image.alt = photos[index].alt;
  position.textContent = `${index + 1} de ${photos.length}`;
  previous.disabled = index === 0; next.disabled = index === photos.length - 1;
  hint.hidden = photos.length < 2;
  if (direction && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.getAnimations().forEach(animation => animation.cancel());
    card.animate([{ transform: `translateX(${direction * 24}px)`, opacity: .65 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 180, easing: 'ease-out' });
  }
}
function move(delta: number) {
  const target = Math.max(0, Math.min(photos.length - 1, index + delta));
  if (target === index) return;
  index = target; render(delta);
}
export function openPhotoViewer(items: ViewerPhoto[], selected: number, source: HTMLElement) {
  if (!dialog || !items.length || selected < 0 || selected >= items.length) return;
  photos = items.slice(); index = selected; opener = source; render();
  if (!dialog.open) dialog.showModal();
  close?.focus({ preventScroll: true });
}
previous?.addEventListener('click', () => move(-1));
next?.addEventListener('click', () => move(1));
close?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('close', () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); opener = null; photos = []; });
dialog?.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowLeft' ? -1 : 1);
});
swipe?.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  start = { id: event.pointerId, x: event.clientX, y: event.clientY };
  swipe.setPointerCapture(event.pointerId);
});
swipe?.addEventListener('pointerup', event => {
  if (!start || start.id !== event.pointerId) return;
  const dx = event.clientX - start.x, dy = event.clientY - start.y;
  start = null;
  if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
});
swipe?.addEventListener('pointercancel', () => { start = null; });
swipe?.addEventListener('lostpointercapture', () => { start = null; });
