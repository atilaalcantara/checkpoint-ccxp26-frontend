import assets from '../assets/official-assets.json';
import { api, ApiError } from './api';
import { getParticipation, refreshParticipation, subscribeParticipation } from './participation';
import { showConfirmedXP } from './community-xp';
import { openPhotoViewer, type ViewerPhoto } from './photo-viewer';

const trigger = document.querySelector<HTMLButtonElement>('[data-photo-trigger]');
const gallery = document.querySelector<HTMLButtonElement>('[data-photo-gallery]');
const choices = document.querySelector<HTMLElement>('[data-photo-choices]');
const input = document.querySelector<HTMLInputElement>('[data-photo-input]');
const camera = document.querySelector<HTMLInputElement>('[data-photo-camera]');
const preview = document.querySelector<HTMLDialogElement>('[data-photo-preview]');
const image = document.querySelector<HTMLImageElement>('[data-photo-preview-image]');
const crop = document.querySelector<HTMLElement>('[data-photo-crop]');
const cropHint = document.querySelector<HTMLElement>('[data-photo-crop-hint]');
const clear = document.querySelector<HTMLButtonElement>('[data-photo-clear]');
const submit = document.querySelector<HTMLButtonElement>('[data-photo-submit]');
const consent = document.querySelector<HTMLInputElement>('[data-photo-consent]');
const complete = document.querySelector<HTMLElement>('[data-photo-complete]');
const status = document.querySelector<HTMLElement>('.photo-preview-status');
const recent = document.querySelector<HTMLElement>('[data-recent-photos]');
const photoReward = document.querySelector<HTMLElement>('#fotos [data-section-reward]');

async function refreshRecent() {
  if (!recent) return;
  const showMessage = (message: string) => { const text = document.createElement('p'); text.className = 'photo-empty'; text.textContent = message; recent.replaceChildren(text); };
  try {
    const { photos } = await api.recentPhotos();
    if (!photos.length) { showMessage('Em breve, os primeiros flagras da CCXP aparecem aqui.'); return; }
    const fan = document.createElement('div'); fan.className = 'photo-fan'; fan.setAttribute('role', 'group'); fan.setAttribute('aria-label', 'Fotos recentes enviadas por visitantes');
    const valid = photos.slice(0, 3).filter(photo => photo.image.mediaType === 'image/avif' && /^[A-Za-z0-9+/]*={0,2}$/.test(photo.image.base64));
    const viewerPhotos: ViewerPhoto[] = valid.map(photo => ({ src: `data:image/avif;base64,${photo.image.base64}`, alt: photo.alt }));
    valid.forEach((photo, index) => {
      const item = document.createElement('div'); item.className = `fan-item fan-item--${valid.length === 1 ? 'center' : valid.length === 2 ? (index ? 'right' : 'left') : ['left', 'center', 'right'][index]}`;
      const action = document.createElement('button'); action.type = 'button'; action.className = 'photo-fan-button'; action.setAttribute('aria-label', `Abrir foto ${index + 1} de ${valid.length}`);
      action.addEventListener('click', () => openPhotoViewer(viewerPhotos, index, action));
      const frame = document.createElement('div'); frame.className = 'polaroid';
      const picture = document.createElement('img'); picture.className = 'polaroid-photo'; picture.src = viewerPhotos[index].src; picture.alt = photo.alt;
      const overlay = document.createElement('img'); overlay.className = 'polaroid-frame'; overlay.src = assets.polaroidFrame.src; overlay.alt = '';
      frame.append(picture, overlay); action.append(frame); item.append(action); fan.append(item);
    });
    recent.replaceChildren(fan);
  } catch { if (!recent.querySelector('.photo-fan')) showMessage('Não foi possível carregar as fotos recentes.'); }
}
if (trigger && gallery && choices && input && camera && preview && image && crop && cropHint && clear && submit && consent && complete && status) {
  let url: string | null = null;
  let selectedFile: File | null = null;
  let lastTrigger: HTMLButtonElement = trigger;
  let busy = false;
  let controller: AbortController | null = null;
  let cancelled = false;
  let retryAt = 0;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelWait: (() => void) | null = null;
  let x = .5, y = .5, adjusted = false;
  let drag: { x: number; y: number; px: number; py: number } | null = null;
  function position() { image!.style.objectPosition = `${x * 100}% ${y * 100}%`; }
  function bounds() {
    const w = image!.clientWidth, h = image!.clientHeight;
    const scale = Math.max(w / image!.naturalWidth, h / image!.naturalHeight);
    return { x: Math.max(0, image!.naturalWidth * scale - w), y: Math.max(0, image!.naturalHeight * scale - h) };
  }
  crop.addEventListener('pointerdown', event => {
    if (!image.naturalWidth || busy) return;
    drag = { x: event.clientX, y: event.clientY, px: x, py: y };
    crop.setPointerCapture(event.pointerId); event.preventDefault();
  });
  crop.addEventListener('pointermove', event => {
    if (!drag) return;
    const excess = bounds();
    if (excess.x) x = Math.max(0, Math.min(1, drag.px - (event.clientX - drag.x) / excess.x));
    if (excess.y) y = Math.max(0, Math.min(1, drag.py - (event.clientY - drag.y) / excess.y));
    adjusted = true; position();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) crop.addEventListener(type, () => { drag = null; });
  crop.addEventListener('keydown', event => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-.05, 0], ArrowRight: [.05, 0], ArrowUp: [0, -.05], ArrowDown: [0, .05] };
    const delta = directions[event.key]; if (!delta || busy) return;
    event.preventDefault(); event.stopPropagation();
    x = Math.max(0, Math.min(1, x + delta[0])); y = Math.max(0, Math.min(1, y + delta[1]));
    adjusted = true; position();
  });
  async function croppedFile(original: File): Promise<File> {
    if (!adjusted || !image!.naturalWidth || !image!.naturalHeight) return compressPhoto(original);
    const iw = image!.naturalWidth, ih = image!.naturalHeight;
    const aspect = 360 / 330;
    const cw = Math.min(iw, ih * aspect), ch = cw / aspect;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2048 / Math.max(cw, ch));
    canvas.width = Math.max(1, Math.round(cw * scale)); canvas.height = Math.max(1, Math.round(ch * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar o recorte. Escolha a foto novamente para enviá-la sem recorte.');
    context.drawImage(image!, (iw - cw) * x, (ih - ch) * y, cw, ch, 0, 0, canvas.width, canvas.height);
    const type = original.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, .92));
    if (!blob || blob.type !== type || !blob.size || blob.size > 10 * 1024 * 1024) throw new Error('Não foi possível preparar o recorte. Escolha a foto novamente para enviá-la sem recorte.');
    return new File([blob], type === 'image/png' ? 'foto.png' : 'foto.jpg', { type });
  }
  async function compressPhoto(original: File): Promise<File> {
    // Keep transparent and unsupported formats untouched; avoid exhausting memory on large phones' images.
    if (original.type !== 'image/jpeg' || !image!.naturalWidth || !image!.naturalHeight || image!.naturalWidth * image!.naturalHeight > 24000000) return original;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image!.naturalWidth; canvas.height = image!.naturalHeight;
      const context = canvas.getContext('2d'); if (!context) return original;
      context.drawImage(image!, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
      if (!blob || blob.type !== 'image/jpeg' || !blob.size || blob.size >= original.size) return original;
      return new File([blob], 'foto.jpg', { type:'image/jpeg' });
    } catch { return original; }
  }
  function reset() {
    consent!.checked = false;
    if (url) URL.revokeObjectURL(url);
    url = null; selectedFile = null; input!.value = ''; camera!.value = ''; image!.removeAttribute('src');
    if (preview!.open) preview!.close();
  }
  function update() {
    const done = getParticipation()?.photoStatus === 'submitted';
    choices!.hidden = done; complete!.hidden = !done;
    if (photoReward) photoReward.hidden = done;
    if (done) reset();
  }
  function delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => { cancelWait = resolve; waitTimer = setTimeout(resolve, ms); }).finally(() => { clearTimeout(waitTimer); cancelWait = null; });
  }
  async function reconcile() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { if ((await refreshParticipation()).photoStatus === 'submitted') { update(); void refreshRecent(); return true; } } catch { /* remain uncertain */ }
      if (attempt === 0) await delay(3000);
    }
    return false;
  }
  trigger.addEventListener('click', () => { lastTrigger = trigger; camera.click(); });
  gallery.addEventListener('click', () => { lastTrigger = gallery; input.click(); });
  const selectFile = (source: HTMLInputElement) => {
    const file = source.files?.[0]; if (!file) return;
    selectedFile = file;
    if (url) URL.revokeObjectURL(url);
    x = y = .5; adjusted = false; position(); crop.hidden = false; cropHint.hidden = false;
    url = URL.createObjectURL(file); image.src = url;
    image.onerror = () => { image.removeAttribute('src'); crop.hidden = true; cropHint.hidden = true; status.textContent = 'Prévia indisponível neste navegador. Você ainda pode enviar o arquivo original.'; };
    status.textContent = 'Prévia local. A foto será publicada após o envio.';
    if (!preview.open) preview.showModal();
    submit.disabled = Date.now() < retryAt;
    submit.focus({ preventScroll: true });
  };
  input.addEventListener('change', () => selectFile(input));
  camera.addEventListener('change', () => selectFile(camera));
  clear.addEventListener('click', () => {
    if (busy) { cancelled = true; controller?.abort(); cancelWait?.(); status.textContent = 'Cancelando; verificando se uma foto foi salva…'; }
    else { reset(); lastTrigger.focus({ preventScroll: true }); }
  });
  preview.addEventListener('cancel', event => {
    event.preventDefault();
    clear.click();
  });
  submit.addEventListener('click', async () => {
    const file = selectedFile; if (!file || busy || Date.now() < retryAt) return;
    if (!consent.checked) { status.textContent = 'Marque a caixa de concordância para enviar a foto.'; consent.focus(); return; }
    busy = true; cancelled = false; submit.disabled = true; clear.textContent = 'Cancelar';
    try {
      const upload = await croppedFile(file);
      await refreshParticipation();
      if (getParticipation()?.photoStatus === 'submitted') { update(); return; }
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        status.textContent = 'Enviando e processando sua foto…'; controller = new AbortController();
        try {
          const result = await api.photo(upload, controller.signal);
          showConfirmedXP(result.awardedXp); await refreshParticipation(); update(); void refreshRecent(); return;
        } catch (e) {
          if (e instanceof ApiError && e.code === 'PROCESSING_BUSY') {
            const value = e.retryAfter?.trim();
            const date = value ? Date.parse(value) : NaN;
            const seconds = value && /^\d+$/.test(value) ? Number(value) : Number.isFinite(date) ? Math.max(0, (date - Date.now()) / 1000) : 5;
            if (attempt < 2 && seconds <= 10 && !cancelled) { status.textContent = 'Processamento ocupado. Tentando novamente…'; await delay(seconds * 1000 + Math.random() * 1000); continue; }
            if (seconds > 10) { retryAt = Date.now() + seconds * 1000; setTimeout(() => { if (!busy && submit) submit.disabled = false; }, seconds * 1000); }
            status.textContent = 'Processamento ocupado. Tente novamente mais tarde.'; return;
          }
          if (e instanceof ApiError && e.code !== 'PHOTO_ALREADY_SUBMITTED' && (e.status < 500 || e.code === 'SERVICE_UNAVAILABLE')) { status.textContent = e.message; return; }
          status.textContent = 'Verificando se uma foto foi salva…';
          if (!await reconcile()) status.textContent = 'Resultado desconhecido. Uma foto ainda pode estar sendo processada; tente verificar novamente mais tarde.';
          return;
        } finally { controller = null; }
      }
      if (cancelled) status.textContent = 'Envio cancelado antes de uma nova tentativa.';
    } catch (e) { status.textContent = e instanceof Error ? e.message : 'Não foi possível iniciar a participação.'; }
    finally { busy = false; submit.disabled = Date.now() < retryAt; clear.textContent = 'Escolher outra'; }
  });
  subscribeParticipation(update); update(); void refreshRecent();
}
