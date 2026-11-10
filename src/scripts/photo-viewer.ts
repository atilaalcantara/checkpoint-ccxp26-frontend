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
const dots = dialog?.querySelector<HTMLElement>('[data-photo-viewer-dots]');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let closing = false;
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
  if (dots) {
    if (dots.children.length !== photos.length) dots.replaceChildren(...photos.map(() => document.createElement('i')));
    Array.from(dots.children).forEach((dot, i) => (dot as HTMLElement).toggleAttribute('data-active', i === index));
    dots.hidden = photos.length < 2;
  }
  if (direction && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.getAnimations().forEach(animation => animation.cancel());
    card.animate([{ transform: `translateX(${direction * 36}px) rotate(${direction * 4}deg)`, opacity: .4 }, { transform: 'translateX(0) rotate(-1.5deg)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.34,1.4,.64,1)' });
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
  if (reduced()) return;
  // Container transform: the viewer grows out of the tapped Polaroid, the photo straightens as it lands.
  const from = source.getBoundingClientRect(), to = dialog.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = Math.max(.3, Math.min(.8, from.width / to.width));
  dialog.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 }, { opacity: 1, offset: .35 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  card?.animate([{ transform: 'rotate(-10deg) scale(.92)' }, { transform: 'rotate(-1.5deg) scale(1)' }], { duration: 560, easing: 'cubic-bezier(.34,1.4,.64,1)' });
  Array.from(dialog.querySelectorAll('.photo-viewer-header, .photo-viewer-controls, .photo-viewer-hint')).forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 140 + i * 50, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}
previous?.addEventListener('click', () => move(-1));
next?.addEventListener('click', () => move(1));
function requestClose() {
  if (!dialog || !dialog.open || closing) return;
  if (reduced()) { dialog.close(); return; }
  closing = true;
  const out = dialog.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(12px) scale(.96)', opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  const done = () => { closing = false; out.cancel(); dialog.close(); };
  out.finished.then(done, () => { closing = false; });
}
close?.addEventListener('click', requestClose);
dialog?.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
dialog?.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) requestClose(); });
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
