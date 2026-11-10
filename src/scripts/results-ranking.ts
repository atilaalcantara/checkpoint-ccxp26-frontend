import type { QuizQuestion } from '../data/quiz-questions';

export interface PollResult { question: QuizQuestion; counts: [number, number]; total: number }

// This view accepts complete snapshots, so the mock source can later be replaced by an API.
export function createResultsRanking(initial: PollResult[], reduced: MediaQueryList) {
  const container = document.createElement('div');
  container.className = 'results-ranking';
  const viewport = document.createElement('div');
  viewport.className = 'results-viewport';
  const scroller = document.createElement('div');
  scroller.className = 'results-scroller';
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', 'Resultados em ordem de votos. Deslize para os lados para ver mais.');
  const grid = document.createElement('div');
  grid.className = 'results-grid';
  const hint = document.createElement('p');
  hint.className = 'results-swipe-hint';
  hint.setAttribute('aria-label', 'Deslize para os lados para ver mais resultados');
  hint.textContent = '↔';
  scroller.append(grid);
  viewport.append(scroller);
  container.append(viewport, hint);
  scroller.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const page = scroller.clientWidth + parseFloat(getComputedStyle(grid).columnGap);
    scroller.scrollBy({ left: event.key === 'ArrowRight' ? page : -page, behavior: reduced.matches ? 'instant' : 'smooth' });
  });

  const cards = new Map<string, HTMLElement>();
  let results: PollResult[] = [];
  let running = false;
  let pending: PollResult[] | null = null;

  function updateCard(card: HTMLElement, result: PollResult) {
    const { question, counts, total } = result;
    const signature = JSON.stringify([question, counts, total]);
    if (card.dataset.content === signature) return;
    card.dataset.content = signature;
    const title = document.createElement('h3');
    title.className = 'result-question'; title.textContent = question.prompt;
    // Longer questions get a little more room without truncating their text.
    const titleSize = Math.max(12, Math.min(15, 15 - Math.max(0, question.prompt.length - 25) * .08));
    title.style.fontSize = `clamp(12px, 12cqi, ${titleSize}px)`;
    const options = document.createElement('div'); options.className = 'result-options';
    question.options.forEach((option, index) => {
      const winner = total > 0 && counts[index] > counts[1 - index];
      const row = document.createElement('div'); row.className = `result-option${winner ? ' result-option--winner' : ''}`;
      const label = document.createElement('span'); label.className = 'result-label'; label.textContent = option.label;
      const percent = document.createElement('strong'); percent.className = 'result-percent';
      const first = total ? Math.round(counts[0] * 100 / total) : 0;
      percent.textContent = total ? `${index === 0 ? first : 100 - first}%` : '—';
      row.append(label, percent);
      if (winner) { const badge = document.createElement('span'); badge.className = 'visually-hidden'; badge.textContent = 'Opção mais votada'; row.append(badge); }
      options.append(row);
    });
    const summary = document.createElement('p'); summary.className = 'result-total';
    const votes = `${total} ${total === 1 ? 'voto' : 'votos'}`;
    summary.textContent = total === 0 ? 'Ainda sem votos' : counts[0] === counts[1] ? `Empate · ${votes}` : votes;
    card.replaceChildren(title, options, summary);
  }

  function render(snapshot: PollResult[], animate: boolean) {
    // IDs make ties deterministic even when polls enter or move between snapshots.
    const ordered = snapshot.slice().sort((a, b) => b.total - a.total || a.question.id.localeCompare(b.question.id));
    const oldVisible = new Map<string, DOMRect>();
    const visibleRect = scroller.getBoundingClientRect();
    for (const [id, card] of cards) {
      const rect = card.getBoundingClientRect();
      if (card.isConnected && rect.right > visibleRect.left + 1 && rect.left < visibleRect.right - 1) oldVisible.set(id, rect);
    }
    const oldOrder = results.map(result => result.question.id);
    const orderChanged = oldOrder.join('\0') !== ordered.map(result => result.question.id).join('\0');
    const shouldAnimate = animate && orderChanged && !reduced.matches && viewport.isConnected;
    const viewportRect = viewport.getBoundingClientRect();
    const pageWidth = scroller.clientWidth + (parseFloat(getComputedStyle(grid).columnGap) || 0);
    const page = pageWidth ? Math.round(scroller.scrollLeft / pageWidth) : 0;
    const nextVisible = new Set(ordered.slice(page * 4, page * 4 + 4).map(result => result.question.id));
    const ghosts: HTMLElement[] = [];
    if (shouldAnimate) for (const [id, rect] of oldVisible) {
      if (nextVisible.has(id)) continue;
      const ghost = cards.get(id)!.cloneNode(true) as HTMLElement;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.classList.add('result-ghost');
      Object.assign(ghost.style, { left: `${rect.left - viewportRect.left}px`, top: `${rect.top - viewportRect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      viewport.append(ghost); ghosts.push(ghost);
    }
    results = ordered;
    const ids = new Set(ordered.map(result => result.question.id));
    for (const [id, card] of cards) if (!ids.has(id)) { card.remove(); cards.delete(id); }
    ordered.forEach((result, index) => {
      let card = cards.get(result.question.id);
      if (!card) { card = document.createElement('article'); card.className = 'result-card'; card.dataset.resultId = result.question.id; cards.set(result.question.id, card); }
      updateCard(card, result);
      card.style.gridColumn = String(Math.floor(index / 4) * 2 + index % 2 + 1);
      card.style.gridRow = String(Math.floor(index % 4 / 2) + 1);
      card.classList.toggle('result-card--page-start', index % 4 === 0);
      // Avoid moving nodes when only vote totals change.
      const atPosition = grid.children[index];
      if (atPosition !== card) grid.insertBefore(card, atPosition ?? null);
    });
    hint.hidden = ordered.length <= 4;
    if (!shouldAnimate) return Promise.resolve();

    const animations: Animation[] = [];
    for (const [id, card] of cards) {
      if (!nextVisible.has(id)) continue;
      const end = card.getBoundingClientRect();
      const start = oldVisible.get(id);
      const oldIndex = oldOrder.indexOf(id);
      const newIndex = ordered.findIndex(result => result.question.id === id);
      const promoted = oldIndex < 0 || newIndex < oldIndex;
      const dx = start ? start.left - end.left : visibleRect.right - end.left + 12;
      const dy = start ? start.top - end.top : 0;
      if (start && Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      card.style.zIndex = promoted ? '2' : '1';
      const shadow = '0 8px 18px rgba(0,0,0,.15)';
      const frames: Keyframe[] = promoted ? [
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, boxShadow: '0 0 0 transparent', offset: 0 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.05)`, boxShadow: shadow, offset: .14 },
        { transform: 'translate(0, 0) scale(1.05)', boxShadow: shadow, offset: .76 },
        { transform: 'translate(0, 0) scale(.99)', boxShadow: '0 2px 5px rgba(0,0,0,.05)', offset: .9 },
        { transform: 'translate(0, 0) scale(1)', boxShadow: '0 0 0 transparent', offset: 1 },
      ] : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }];
      const animation = card.animate(frames, { duration: 820, easing: 'cubic-bezier(.22,.7,.25,1)' });
      animations.push(animation);
      animation.finished.catch(() => {}).finally(() => { card!.style.zIndex = ''; });
    }
    for (const ghost of ghosts) {
      const animation = ghost.animate([{ transform: 'translateX(0) scale(1)', opacity: 1 }, { transform: `translateX(${visibleRect.right - ghost.getBoundingClientRect().left + 12}px) scale(.98)`, opacity: .7 }], { duration: 820, easing: 'cubic-bezier(.22,.7,.25,1)' });
      animations.push(animation); animation.finished.catch(() => {}).finally(() => ghost.remove());
    }
    return Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {});
  }

  function update(snapshot: PollResult[]) {
    if (running) { pending = snapshot; return; }
    running = true;
    void render(snapshot, true).finally(() => {
      running = false;
      if (pending) { const next = pending; pending = null; update(next); }
    });
  }
  void render(initial, false);
  return { element: container, update, getResults: () => results };
}
