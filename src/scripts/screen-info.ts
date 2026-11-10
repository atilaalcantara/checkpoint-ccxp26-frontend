import { expandFrom } from './container-motion';

for (const details of document.querySelectorAll<HTMLDetailsElement>('.screen-info')) {
  const trigger = details.querySelector<HTMLElement>('summary');
  const content = details.querySelector<HTMLElement>('.info-content');
  if (!trigger || !content || !('showModal' in HTMLDialogElement.prototype)) continue;
  const dialog = document.createElement('dialog');
  dialog.className = 'info-dialog';
  const heading = content.querySelector('strong');
  if (heading) { heading.id = `info-${details.closest('section')?.id}`; dialog.setAttribute('aria-labelledby', heading.id); }
  const closeButton = document.createElement('button');
  closeButton.type = 'button'; closeButton.className = 'info-close'; closeButton.textContent = 'Fechar';
  dialog.append(content, closeButton);
  document.body.append(dialog);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  let animation: Animation | null = null;
  let closing = false;
  async function close(): Promise<void> {
    if (closing || !dialog.open) return;
    closing = true;
    if (animation?.playState === 'running') animation.reverse();
    else { animation?.cancel(); animation = expandFrom(dialog, trigger!, true); }
    await animation?.finished.catch(() => {});
    dialog.close(); animation?.cancel(); animation = null; closing = false;
    trigger!.setAttribute('aria-expanded', 'false');
    trigger!.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', event => {
    event.preventDefault();
    if (dialog.open) return;
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    animation = expandFrom(dialog, trigger);
    animation?.finished.then(() => { if (!closing) { animation?.cancel(); animation = null; } }).catch(() => {});
  });
  closeButton.addEventListener('click', () => void close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); void close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) void close();
  } });
}
