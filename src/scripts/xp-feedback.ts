let timeout = 0;
export function showXPFeedback(awardedXp: number): void {
  let feedback = document.querySelector<HTMLElement>('[data-xp-feedback]');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.dataset.xpFeedback = '';
    feedback.className = 'xp-feedback';
    feedback.setAttribute('role', 'status');
    document.body.append(feedback);
  }
  window.clearTimeout(timeout);
  feedback.getAnimations().forEach(animation => animation.cancel());
  feedback.textContent = `+${awardedXp} XP`;
  feedback.hidden = false;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    feedback.animate([
      { opacity: 0, transform: 'translate(-50%, 6px)' },
      { opacity: 1, transform: 'translate(-50%, 0)', offset: .18 },
      { opacity: 1, transform: 'translate(-50%, 0)', offset: .75 },
      { opacity: 0, transform: 'translate(-50%, -6px)' },
    ], { duration: 1200, easing: 'ease-out' });
  }
  timeout = window.setTimeout(() => { if (feedback) feedback.hidden = true; }, 1200);
}
