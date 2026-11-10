import { screenEntrances } from './screen-entrance';
import { activate } from './defer-images';

function setupNavigation(viewport: HTMLElement, shell: HTMLElement): void {
  const screens = [...viewport.querySelectorAll<HTMLElement>('.experience-screen')];
  const links = [...shell.querySelectorAll<HTMLAnchorElement>('[data-screen-link]')];
  const navigation = shell.querySelector<HTMLElement>('[data-bottom-navigation]');
  const capsule = shell.querySelector<HTMLElement>('[data-navigation-capsule]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const entrances = screenEntrances(reducedMotion);
  entrances.prepare(screens);
  for (const screen of screens) {
    screen.addEventListener('pointerdown', () => entrances.dismiss(screen), { passive: true });
    screen.addEventListener('keydown', () => entrances.dismiss(screen));
  }
  const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  let activeIndex = 0;
  let destinationIndex = 0;
  let settling = false;
  let draggingScreen = false;
  let motionFrame = 0;
  let navigationAnimation: Animation | null = null;
  let motionVersion = 0;
  let touchActive = false;
  let alignmentTimer = 0;
  const height = (): number => viewport.getBoundingClientRect().height;
  const clampIndex = (index: number): number => Math.max(0, Math.min(screens.length - 1, index));

  function stopMotion(): void {
    motionVersion += 1;
    navigationAnimation?.cancel();
    navigationAnimation = null;
    cancelAnimationFrame(motionFrame);
    entrances.cancel();
    settling = false;
    draggingScreen = false;
    viewport.removeAttribute('data-motion');
  }

  function finish(index: number): void {
    destinationIndex = clampIndex(index);
    viewport.scrollTop = destinationIndex * height();
    updateActive(destinationIndex);
    stopMotion();
    entrances.present(screens[destinationIndex]);
  }
  type CapsuleGesture = {
    pointerId: number; source: HTMLAnchorElement; x: number; y: number;
    left: number; positions: number[]; preview: number;
    axis: 'pending' | 'horizontal' | 'vertical';
  };
  let capsuleGesture: CapsuleGesture | null = null;
  let suppressNavClick = false;

  function positionCapsule(index: number): void {
    if (!navigation || !capsule || capsuleGesture) return;
    const item = links[index].getBoundingClientRect();
    const nav = navigation.getBoundingClientRect();
    navigation.style.setProperty('--capsule-x', `${item.left - nav.left - navigation.clientLeft}px`);
    navigation.style.setProperty('--capsule-y', `${item.top - nav.top - navigation.clientTop}px`);
    navigation.style.setProperty('--capsule-width', `${item.width}px`);
    navigation.style.setProperty('--capsule-height', `${item.height}px`);
    navigation.dataset.enhanced = 'true';
  }

  function clearCapsuleGesture(): CapsuleGesture | null {
    const gesture = capsuleGesture;
    capsuleGesture = null;
    navigation?.removeAttribute('data-dragging');
    links.forEach(link => link.removeAttribute('data-preview'));
    if (gesture?.source.hasPointerCapture(gesture.pointerId)) gesture.source.releasePointerCapture(gesture.pointerId);
    return gesture;
  }

  function updateActive(index: number): void {
    if (index !== activeIndex && capsuleGesture) clearCapsuleGesture();
    const previous = screens[activeIndex];
    const transferFocus = index !== activeIndex && previous.contains(document.activeElement);
    activeIndex = index;
    activate(screens[index]);
    positionCapsule(index);
    screens.forEach((screen, i) => { screen.inert = i !== index; });
    for (const link of links) {
      if (link.dataset.screenLink === screens[index].id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (transferFocus) screens[index].querySelector<HTMLElement>('[data-screen-scroll]')?.focus({ preventScroll: true });
    // Do not move the initial keyboard traversal point past the skip link.
    if (location.hash || index !== 0) history.replaceState(null, '', `#${screens[index].id}`);
  }

  function navigate(index: number, direct = false): void {
    if (settling && !direct) return;
    destinationIndex = clampIndex(index);
    if (direct || reducedMotion.matches) { stopMotion(); finish(destinationIndex); return; }
    const from = viewport.scrollTop;
    entrances.cancel();
    const to = destinationIndex * height();
    const start = performance.now();
    settling = true;
    draggingScreen = false;
    viewport.dataset.motion = 'settling';
    // Critically damped-like, monotonic deceleration: no visible overshoot.
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / 260);
      viewport.scrollTop = from + (to - from) * (1 - Math.pow(1 - progress, 4));
      if (progress < 1) motionFrame = requestAnimationFrame(tick);
      else finish(destinationIndex);
    };
    motionFrame = requestAnimationFrame(tick);
  }

  // Native scrolling can take over on iOS (for example after an interrupted
  // gesture). Once scrolling is quiet, never leave the viewport between pages.
  function checkAlignment(): void {
    window.clearTimeout(alignmentTimer);
    alignmentTimer = window.setTimeout(() => {
      if (touchActive || settling || draggingScreen || document.hidden) return;
      const pageHeight = height();
      if (!pageHeight) return;
      const nearest = clampIndex(Math.round(viewport.scrollTop / pageHeight));
      if (Math.abs(viewport.scrollTop - nearest * pageHeight) > 2) navigate(nearest);
    }, 200);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (!settling && !draggingScreen && entry.isIntersecting && entry.intersectionRatio >= .6) {
      updateActive(screens.indexOf(entry.target as HTMLElement));
      entrances.present(entry.target as HTMLElement);
    }
  }, { root: viewport, threshold: .6 });
  screens.forEach(screen => observer.observe(screen));

  async function directTo(index: number): Promise<void> {
    if (settling || draggingScreen || index === activeIndex) return;
    if (reducedMotion.matches) { navigate(index, true); return; }
    settling = true;
    entrances.cancel();
    viewport.dataset.motion = 'direct';
    const version = motionVersion;
    try {
      destinationIndex = clampIndex(index);
      viewport.scrollTop = destinationIndex * height();
      updateActive(destinationIndex);
      // Keep the surface opaque. Only the incoming content moves a few px;
      // no global fade competing with image decoding or entrance effects.
      const content = screens[destinationIndex].querySelector<HTMLElement>('[data-screen-scroll]')!;
      navigationAnimation = content.animate([{ transform: 'translateY(6px)' }, { transform: 'translateY(0)' }], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
      await navigationAnimation.finished;
      if (version === motionVersion) finish(destinationIndex);
    } catch { if (version === motionVersion) finish(destinationIndex); }
  }

  const scene = viewport.querySelector<HTMLElement>('.scene-composition');
  let parallaxFrame = 0;
  function parallax(): void {
    cancelAnimationFrame(parallaxFrame);
    parallaxFrame = requestAnimationFrame(() => {
      // Move environment AND characters together: their ground contact stays exact.
      if (scene) {
        const offset = Math.min(1, viewport.scrollTop / height()) * 8;
        if (reducedMotion.matches || offset < .01) scene.style.removeProperty('transform');
        else scene.style.transform = `translateY(${offset}px)`;
      }
    });
  }
  viewport.addEventListener('scroll', () => { parallax(); checkAlignment(); }, { passive: true });
  reducedMotion.addEventListener('change', () => { stopMotion(); finish(activeIndex); parallax(); });

  for (const link of links) link.addEventListener('click', event => {
    event.preventDefault();
    const index = screens.findIndex(screen => screen.id === link.dataset.screenLink);
    // Direct selection never fades the surface; gestures retain their slide.
    if (index >= 0) void directTo(index);
  });

  // The same capsule serves touch, mouse and pen; selection changes only on release.
  if (navigation) {
    navigation.addEventListener('click', event => {
      if (!suppressNavClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });
    navigation.addEventListener('pointerdown', event => {
      const source = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('[data-screen-link]') : null;
      if (settling || draggingScreen || !event.isPrimary || event.button !== 0 || !source || source !== links[activeIndex]) return;
      const nav = navigation.getBoundingClientRect();
      const positions = links.map(link => link.getBoundingClientRect().left - nav.left - navigation.clientLeft);
      capsuleGesture = { pointerId: event.pointerId, source, x: event.clientX, y: event.clientY,
        left: positions[activeIndex], positions, preview: activeIndex, axis: 'pending' };
      source.setPointerCapture(event.pointerId);
    });
    navigation.addEventListener('pointermove', event => {
      const gesture = capsuleGesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (gesture.axis === 'pending') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (gesture.axis !== 'horizontal') return;
      if (event.cancelable) event.preventDefault();
      const x = Math.max(gesture.positions[0], Math.min(gesture.positions.at(-1)!, gesture.left + dx));
      gesture.preview = gesture.positions.reduce((nearest, position, index) =>
        Math.abs(position - x) < Math.abs(gesture.positions[nearest] - x) ? index : nearest, 0);
      navigation.dataset.dragging = 'true';
      navigation.style.setProperty('--capsule-x', `${x}px`);
      links.forEach((link, i) => link.toggleAttribute('data-preview', i === gesture.preview));
    });
    const release = (event: PointerEvent): void => {
      if (capsuleGesture?.pointerId !== event.pointerId) return;
      const gesture = clearCapsuleGesture();
      if (gesture?.axis === 'horizontal') {
        suppressNavClick = true;
        window.setTimeout(() => { suppressNavClick = false; }, 0);
        void directTo(gesture.preview);
        links[gesture.preview].focus({ preventScroll: true });
      } else positionCapsule(activeIndex);
    };
    navigation.addEventListener('pointerup', release);
    const cancel = (): void => { clearCapsuleGesture(); positionCapsule(activeIndex); };
    navigation.addEventListener('pointercancel', cancel);
    navigation.addEventListener('lostpointercapture', () => { if (capsuleGesture) cancel(); });
  }

  function innerScroller(target: EventTarget | null, direction = 0): HTMLElement | null {
    let element = target instanceof Element ? target : null;
    let fallback: HTMLElement | null = null;
    while (element && element !== viewport) {
      if (element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(element).overflowY)) {
        fallback ??= element;
        if (!direction || canScroll(element, direction)) return element;
      }
      element = element.parentElement;
    }
    return fallback;
  }

  function canScroll(element: HTMLElement | null, direction: number): boolean {
    return !!element && (direction > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 1);
  }

  // A wheel/trackpad gesture ends after an idle gap, including its momentum tail.
  // These non-passive handlers are local to the screen viewport, never the document.
  let wheelIdleTimer = 0;
  let wheelDistance = 0;
  let wheelConsumed = false;
  let wheelInner: HTMLElement | null = null;
  let wheelStarted = false;
  viewport.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const direction = Math.sign(event.deltaY);
    if (!wheelStarted) {
      const inner = innerScroller(event.target, direction);
      wheelInner = canScroll(inner, direction) ? inner : null;
      wheelStarted = true;
    }
    window.clearTimeout(wheelIdleTimer);
    wheelIdleTimer = window.setTimeout(() => {
      wheelStarted = false; wheelConsumed = false; wheelDistance = 0; wheelInner = null;
    }, 200);
    if (wheelInner) {
      // The gesture that scrolls internal content cannot also change screens.
      if (!canScroll(wheelInner, direction)) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (wheelConsumed) return;
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? viewport.clientHeight : 1;
    wheelDistance += event.deltaY * unit;
    if (Math.abs(wheelDistance) >= 48) {
      wheelConsumed = true;
      navigate(destinationIndex + Math.sign(wheelDistance));
    }
  }, { passive: false });

  let touchX = 0;
  let touchY = 0;
  let touchMode: 'pending' | 'inner' | 'screen' | 'native' | 'ignore' = 'ignore';
  let touchInner: HTMLElement | null = null;
  let gestureIndex = 0;
  let gestureStartTop = 0;
  let interruptedSettle = false;
  let gestureDistance = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  const interactive = `${editable}, button, a, summary, dialog, [role="button"]`;
  viewport.addEventListener('dragstart', event => {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  });
  viewport.addEventListener('touchstart', event => {
    touchActive = true;
    window.clearTimeout(alignmentTimer);
    if (event.touches.length !== 1 || (event.target instanceof Element && event.target.closest(`${editable}, summary, dialog`))) {
      if (draggingScreen) navigate(gestureIndex);
      touchMode = 'ignore'; return;
    }
    interruptedSettle = settling;
    if (settling) {
      stopMotion();
      // Keep CSS snap disabled until the new gesture decides its destination.
      viewport.dataset.motion = 'dragging';
    }
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;
    touchInner = innerScroller(event.target);
    gestureStartTop = viewport.scrollTop;
    gestureIndex = interruptedSettle ? clampIndex(Math.round(gestureStartTop / height())) : activeIndex;
    gestureDistance = 0;
    velocity = 0;
    lastY = touchY;
    lastTime = performance.now();
    touchMode = 'pending';
  }, { passive: true });
  viewport.addEventListener('touchmove', event => {
    if (touchMode === 'ignore' || touchMode === 'native' || event.touches.length !== 1) {
      if (draggingScreen) navigate(gestureIndex);
      touchMode = 'ignore'; return;
    }
    const dy = touchY - event.touches[0].clientY;
    const dx = touchX - event.touches[0].clientX;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
    if (touchMode === 'pending' && Math.abs(dx) > Math.abs(dy)) { touchMode = 'ignore'; return; }
    if (touchMode === 'pending') {
      touchInner = innerScroller(event.target, Math.sign(dy));
      touchMode = canScroll(touchInner, Math.sign(dy)) ? 'inner' : 'screen';
      if (touchMode === 'screen') {
        entrances.cancel();
        draggingScreen = true;
        viewport.dataset.motion = 'dragging';
      }
    }
    if (touchMode === 'inner') {
      if (!canScroll(touchInner, Math.sign(dy))) event.preventDefault();
      return;
    }
    if (!event.cancelable) {
      // Do not fight the browser's native scrolling if it already owns this gesture.
      draggingScreen = false;
      viewport.removeAttribute('data-motion');
      touchMode = 'native';
      return;
    }
    event.preventDefault();
    const now = performance.now();
    velocity = (lastY - event.touches[0].clientY) / Math.max(1, now - lastTime);
    lastY = event.touches[0].clientY;
    lastTime = now;
    gestureDistance = Math.max(-height(), Math.min(height(), dy));
    if (!reducedMotion.matches) viewport.scrollTop = Math.max(0, Math.min((screens.length - 1) * height(), gestureStartTop + gestureDistance));
  }, { passive: false });
  function endGesture(cancelled = false): void {
    if (touchMode === 'screen') {
      const fast = performance.now() - lastTime < 120 && Math.abs(velocity) > .5 && Math.abs(gestureDistance) > 24 && Math.sign(velocity) === Math.sign(gestureDistance);
      const commit = !cancelled && (Math.abs(gestureDistance) >= height() * .25 || fast);
      navigate(gestureIndex + (commit ? Math.sign(gestureDistance) : 0));
    } else if (interruptedSettle && touchMode !== 'native') {
      navigate(clampIndex(Math.round(viewport.scrollTop / height())));
    }
    interruptedSettle = false;
    touchMode = 'ignore';
  }
  viewport.addEventListener('touchend', event => { touchActive = event.touches.length > 0; if (!touchActive) { endGesture(); checkAlignment(); } }, { passive: true });
  viewport.addEventListener('touchcancel', event => { touchActive = event.touches.length > 0; endGesture(true); if (!touchActive) checkAlignment(); }, { passive: true });

  // Mouse/pen use the same distance/velocity decision; native touch remains
  // on local Touch Events so Safari's internal scrolling and pinch stay intact.
  let mousePointer: number | null = null;
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.button !== 0 || settling || (event.target as Element).closest(interactive)) return;
    if (innerScroller(event.target)) return;
    mousePointer = event.pointerId;
    touchMode = 'pending'; gestureIndex = activeIndex;
    touchX = event.clientX; touchY = lastY = event.clientY;
    lastTime = performance.now(); velocity = gestureDistance = 0;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (event.pointerId !== mousePointer) return;
    const dy = touchY - event.clientY;
    if (touchMode === 'pending') {
      if (Math.max(Math.abs(dy), Math.abs(event.clientX - touchX)) < 8) return;
      if (Math.abs(event.clientX - touchX) > Math.abs(dy)) { touchMode = 'ignore'; return; }
      entrances.cancel();
      touchMode = 'screen'; draggingScreen = true; viewport.dataset.motion = 'dragging';
    }
    if (touchMode !== 'screen') return;
    event.preventDefault();
    const now = performance.now(); velocity = (lastY - event.clientY) / Math.max(1, now - lastTime);
    lastY = event.clientY; lastTime = now;
    gestureDistance = Math.max(-height(), Math.min(height(), dy));
    if (!reducedMotion.matches) viewport.scrollTop = Math.max(0, Math.min((screens.length - 1) * height(), gestureIndex * height() + gestureDistance));
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(type, event => {
    if ((event as PointerEvent).pointerId !== mousePointer) return;
    mousePointer = null; endGesture(type !== 'pointerup');
  });

  shell.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest(`${editable}, button`) || (event.key === ' ' && target.closest('a'))) return;
    const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1
      : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
    const inner = innerScroller(target, direction);
    if (direction && canScroll(inner, direction)) return;
    if (direction) { event.preventDefault(); if (!event.repeat) navigate(destinationIndex + direction); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); navigate(event.key === 'Home' ? 0 : screens.length - 1, true); }
  });

  function restoreHash(): void {
    const index = screens.findIndex(screen => `#${screen.id}` === location.hash);
    if (index >= 0) navigate(index, true);
    else if (!location.hash) navigate(0, true);
  }
  window.addEventListener('hashchange', restoreHash);
  let previousSize = `${viewport.clientWidth}:${height()}:${navigation?.clientHeight}`;
  const resizeObserver = new ResizeObserver(() => {
    const nextSize = `${viewport.clientWidth}:${height()}:${navigation?.clientHeight}`;
    if (nextSize === previousSize) return;
    previousSize = nextSize;
    stopMotion(); touchMode = 'ignore'; mousePointer = null;
    clearCapsuleGesture();
    navigate(activeIndex, true);
  });
  resizeObserver.observe(viewport);
  if (navigation) resizeObserver.observe(navigation);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopMotion(); touchMode = 'ignore'; mousePointer = null;
    finish(activeIndex);
  });
  restoreHash();
}

const viewport = document.querySelector<HTMLElement>('[data-screen-viewport]');
const shell = document.querySelector<HTMLElement>('[data-experience]');
if (viewport && shell) setupNavigation(viewport, shell);
