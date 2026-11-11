type SiteStatus = 'live' | 'before' | 'paused' | 'ended';

const gate = document.querySelector<HTMLElement>('[data-site-gate]');
const content = document.querySelector<HTMLElement>('[data-site-content]');

if (gate && content) {
  const panels = [...gate.querySelectorAll<HTMLElement>('[data-site-panel]')];
  const base = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
  let previous: SiteStatus | null = null;
  let busy = false;
  let timer: ReturnType<typeof setTimeout>;

  function showPanel(name: string) {
    for (const panel of panels) {
      const active = panel.dataset.sitePanel === name;
      if (active) {
        const image = panel.querySelector<HTMLImageElement>('[data-site-image]');
        if (image && !image.hasAttribute('src')) image.src = image.dataset.siteImage!;
      }
      panel.hidden = !active;
    }
  }

  async function check() {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    try {
      const response = await fetch(`${base}/api/v1/site-status`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Estado indisponível');
      const { status } = await response.json() as { status: unknown };
      if (status !== 'live' && status !== 'before' && status !== 'paused' && status !== 'ended') throw new Error('Estado inválido');
      if (previous && previous !== 'live' && status === 'live') { location.reload(); return; }
      const focusWasInContent = content!.contains(document.activeElement) || gate!.contains(document.activeElement);
      const changed = previous !== status;
      previous = status;
      content!.inert = status !== 'live';
      gate!.hidden = status === 'live';
      if (status !== 'live') {
        showPanel(status);
        if (changed && focusWasInContent) gate!.querySelector<HTMLElement>(`[data-site-panel="${status}"] h1`)?.focus();
      }
    } catch {
      // Keep the last confirmed state during temporary network failures.
      if (!previous) showPanel('error');
    } finally {
      busy = false;
      if (!document.hidden) timer = setTimeout(check, 60000);
    }
  }

  gate.querySelectorAll<HTMLButtonElement>('[data-site-retry]').forEach((button) => button.addEventListener('click', () => void check()));
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) void check(); });
  window.addEventListener('online', () => void check());
  window.addEventListener('checkpoint:site-status', () => void check());
  void check();
}
export {};
