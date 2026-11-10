// Keeps this file's top-level bindings (viewport, screens, observer) in
// their own module scope instead of TypeScript's shared global-script scope
// — otherwise `const viewport` here collides with the same name in
// screen-navigation.ts, which has no imports/exports of its own either.
export {};

// Defers any <img data-src> / <source data-srcset> until its ancestor
// `.experience-screen` starts intersecting the viewport. Unlike the native
// `loading="lazy"` attribute (whose lookahead distance can be generous
// enough to still fetch a screen one swipe away — measured during this
// project's own performance pass, see ASSET_OPTIMIZATION.md), this only
// activates once the screen is actually being scrolled into view.
// Deliberately generic: any current or future screen can opt an image into
// this by using data-src/data-srcset instead of src/srcset — it is not
// specific to Fotos or Enquete.
export function activate(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLImageElement | HTMLSourceElement>('[data-src], [data-srcset]')) {
    if (el.dataset.srcset) {
      el.srcset = el.dataset.srcset;
      delete el.dataset.srcset;
    }
    if (el.dataset.src) {
      (el as HTMLImageElement).src = el.dataset.src;
      delete el.dataset.src;
    }
  }
}

const viewport = document.querySelector<HTMLElement>('[data-screen-viewport]');
const screens = document.querySelectorAll<HTMLElement>('.experience-screen');
if (viewport && screens.length) {
  // threshold must be > 0: screens are flush against each other (no gap), so
  // the next screen's top edge exactly touches the viewport's bottom edge
  // at scrollTop 0 — a `threshold: 0` reports that boundary touch itself as
  // "intersecting" (ratio 0 still satisfies ">= 0"), activating images for a
  // screen that is not actually visible yet. A small positive threshold
  // requires real, visible overlap first.
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < .01) continue;
      activate(entry.target);
      observer.unobserve(entry.target);
    }
  }, { root: viewport, threshold: 0.01 });
  screens.forEach(screen => observer.observe(screen));
}
