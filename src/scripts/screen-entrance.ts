// One short presentation per screen per document. CSS always defines the
// resting state; canceling an effect immediately reveals that state.
export function screenEntrances(preference: MediaQueryList) {
  const visited = new Set<HTMLElement>();
  const effects = new Set<Animation>();
  let version = 0;

  function prepare(screens: HTMLElement[]): void {
    // The next screen must already be clean while it follows the finger.
    for (const screen of screens) if (screen.id !== 'inicio') screen.dataset.entrancePending = '';
  }

  function cancel(): void {
    version += 1;
    for (const effect of effects) effect.cancel();
    effects.clear();
    for (const screen of visited) {
      delete screen.dataset.entrancePending;
      delete screen.dataset.fanPending;
    }
  }

  function animate(element: HTMLElement | null, delay: number, x = 0, y = 6): void {
    if (!element) return;
    const rest = getComputedStyle(element).transform;
    track(element, [
      { opacity: .25, transform: `translate(${x}px, ${y}px) ${rest === 'none' ? '' : rest}` },
      { opacity: 1, transform: rest },
    ], delay);
  }

  function track(element: HTMLElement | null, frames: Keyframe[], delay: number, duration = 580): void {
    if (!element) return;
    try {
      const effect = element.animate(frames, { duration, delay, easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'backwards' });
      effects.add(effect);
      effect.finished.then(() => effect.cancel()).catch(() => {}).finally(() => effects.delete(effect));
    } catch { /* Optional enhancement: resting CSS is already visible. */ }
  }

  function present(screen: HTMLElement): void {
    if (visited.has(screen)) return;
    visited.add(screen);
    screen.dataset.presented = 'true';
    if (preference.matches || document.hidden) {
      delete screen.dataset.entrancePending;
      return;
    }
    if (screen.id === 'inicio') {
      animate(screen.querySelector('.brand'), 0);
      animate(screen.querySelector('.character-juh'), 160, 0, 8);
      animate(screen.querySelector('.character-atila'), 300, 0, 8);
      animate(screen.querySelector('.experience-progress'), 390);
      // A1: the lower edge acts as a temporary mask while Korok peeks out.
      track(screen.querySelector('.mascot img'), [
        { transform: 'translateY(45px)', clipPath: 'inset(0 0 45px 0)' },
        { transform: 'translateY(50px)', clipPath: 'inset(0 0 50px 0)', offset: .18 },
        { transform: 'translateY(-5px)', clipPath: 'inset(0)', offset: .68 },
        { transform: 'translateY(0)', clipPath: 'inset(0)' },
      ], 480, 750);
      track(screen.querySelector('.speech-bubble'), [
        { opacity: 0, transform: 'scale(.82)', transformOrigin: 'left center' },
        { opacity: 1, transform: 'scale(1.025)', transformOrigin: 'left center', offset: .75 },
        { opacity: 1, transform: 'scale(1)', transformOrigin: 'left center' },
      ], 1030, 450);
      track(screen.querySelector('.mascot-message'), [
        { opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 },
      ], 1030, 450);
    } else if (screen.id === 'enquete') {
      animate(screen.querySelector('.section-icon'), 0);
      animate(screen.querySelector('.section-title'), 120);
      animate(screen.querySelector('.section-lead'), 220);
      animate(screen.querySelector('.quiz-prompt'), 340);
      const options = screen.querySelectorAll<HTMLElement>('.quiz-option');
      // C1: alternatives approach from opposing sides, then gently settle.
      options.forEach((option, index) => {
        const side = index === 0 ? -1 : 1;
        track(option, [
          { opacity: 0, transform: `translateX(${side * 38}px)` },
          { opacity: 1, transform: `translateX(${-side * 2}px)`, offset: .82 },
          { opacity: 1, transform: 'translateX(0)' },
        ], 180 + index * 90, 670);
      });
    } else if (screen.id === 'fotos') {
      animate(screen.querySelector('.section-icon'), 0);
      animate(screen.querySelector('.section-title'), 120);
      animate(screen.querySelector('.section-lead'), 220);
      animate(screen.querySelector('.photo-panel-title'), 280);
      const ticket = version;
      const images = [...screen.querySelectorAll<HTMLImageElement>('.photo-fan img')];
      screen.dataset.fanPending = '';
      // Wait briefly for the real images; a slow or failed decode must never
      // leave the fan hidden indefinitely.
      let timeout = 0;
      void Promise.race([
        Promise.allSettled(images.map(image => image.decode())),
        new Promise<void>(resolve => { timeout = window.setTimeout(resolve, 1200); }),
      ]).then(() => {
        clearTimeout(timeout);
        if (ticket !== version || screen.inert || preference.matches || document.hidden) {
          delete screen.dataset.fanPending;
          return;
        }
        // B1: start nearly stacked, then return exactly to the CSS fan.
        const spread = (screen.querySelector<HTMLElement>('.recent-photos')?.clientWidth ?? 0) * .23;
        for (const [selector, side, delay] of [
          ['.fan-item--left', -1, 0],
          ['.fan-item--right', 1, 45],
          ['.fan-item--center', 0, 70],
        ] as const) {
          const item = screen.querySelector<HTMLElement>(selector);
          if (!item) continue;
          const rest = getComputedStyle(item).transform;
          track(item, [
            { opacity: .8, transform: `translate(${-side * spread}px, 7px) ${rest} rotate(${-side * 10}deg)` },
            { opacity: 1, transform: `translate(${side * 3}px, -3px) ${rest} rotate(${side * 1.5}deg)`, offset: .78 },
            { opacity: 1, transform: rest },
          ], delay, 720);
        }
        animate(screen.querySelector('[data-photo-trigger]'), 320);
        delete screen.dataset.fanPending;
      });
    }
    delete screen.dataset.entrancePending;
  }
  function dismiss(screen: HTMLElement): void {
    cancel();
    // Never introduce an entrance underneath a task already being used.
    visited.add(screen);
    screen.dataset.presented = 'true';
    delete screen.dataset.entrancePending;
    delete screen.dataset.fanPending;
  }
  return { prepare, present, cancel, dismiss };
}
