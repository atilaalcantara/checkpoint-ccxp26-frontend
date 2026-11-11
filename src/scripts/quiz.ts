import { api, ApiError, type AssignedPoll } from './api';
import { getParticipation, refreshParticipation } from './participation';
import { showConfirmedXP } from './community-xp';
import { createResultsRanking, type PollResult } from './results-ranking';

const stage = document.querySelector<HTMLElement>('[data-quiz-stage]');
const live = document.querySelector<HTMLElement>('[data-quiz-live]');
const screen = stage?.closest<HTMLElement>('.experience-screen');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let currentId: string | null = null;
let busy = false;
let resultsActive = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let resultsPending = false;
let ranking: ReturnType<typeof createResultsRanking> | null = null;
let resultStatus: HTMLElement | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function announce(message: string) { if (live) live.textContent = message; }
function button(text: string, action: () => void, cls = 'button-primary quiz-continue') {
  const node = el('button', cls, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
function error(message: string) {
  if (!stage) return;
  const feedback = el('div', 'quiz-feedback');
  feedback.append(el('p', 'quiz-error', message), button('Tentar novamente', () => void load()));
  stage.replaceChildren(feedback);
  announce(message);
}
async function load() {
  try { await refreshParticipation(); render(); }
  catch (e) { error(e instanceof TypeError ? 'Não foi possível conectar. Tente novamente.' : e instanceof Error ? e.message : 'Não foi possível carregar as enquetes.'); }
}
async function vote(poll: AssignedPoll, optionId: string, keyboard: boolean) {
  if (busy) return;
  busy = true;
  stage?.querySelectorAll<HTMLButtonElement>('button').forEach(node => { node.disabled = true; });
  announce('Enviando resposta…');
  let confirmed = false;
  try {
    const result = await api.vote(poll.id, optionId);
    confirmed = true;
    showConfirmedXP(result.awardedXp);
  } catch (e) {
    if (e instanceof ApiError && e.code !== 'ALREADY_VOTED') {
      busy = false; error(e.message); return;
    }
  }
  try {
    const state = await refreshParticipation();
    const answer = state.polls.find(item => item.id === poll.id)?.answerOptionId;
    if (!answer) {
      busy = false;
      error(confirmed ? 'Resposta recebida; não foi possível atualizar a participação. Tente consultar novamente.' : 'Ainda não foi possível confirmar sua resposta. Consulte novamente antes de tentar outra opção.');
      return;
    }
    currentId = null; busy = false; render();
    if (keyboard && !state.resultsUnlocked) stage?.querySelector<HTMLButtonElement>('[data-quiz-option]')?.focus({ preventScroll: true });
  } catch {
    busy = false; error('Não foi possível confirmar sua resposta. Tente consultar novamente.');
  }
}
function render() {
  if (!stage || resultsActive) return;
  const state = getParticipation();
  if (!state) { void load(); return; }
  if (state.resultsUnlocked) {
    announce('Enquetes concluídas. Resultados desbloqueados.'); openResults(); return;
  }
  let poll = state.polls.find(item => item.id === currentId);
  if (!poll || poll.answerOptionId) poll = state.polls.find(item => !item.answerOptionId);
  if (!poll) {
    const feedback = el('div', 'quiz-feedback');
    feedback.append(el('p', 'quiz-complete-text', 'Não há enquetes suficientes disponíveis agora. Volte mais tarde!'), button('Atualizar', () => void load()));
    stage.replaceChildren(feedback);
    return;
  }
  currentId = poll.id;
  const selected = poll.answerOptionId;
  const prompt = el('h3', 'quiz-prompt', poll.title); prompt.dataset.quizPrompt = '';
  const options = el('div', 'quiz-options'); options.setAttribute('role', 'group'); options.setAttribute('aria-label', poll.title);
  poll.options.forEach((option, index) => {
    const node = el('button', `quiz-option quiz-option--${index ? 'olive' : 'lavender'}`, option.label);
    node.type = 'button';
    node.addEventListener('click', event => void vote(poll!, option.id, event.detail === 0));
    node.dataset.quizOption = option.id;
    if (selected) { node.disabled = true; node.setAttribute('aria-pressed', String(selected === option.id)); if (selected === option.id) node.dataset.selected = 'true'; }
    options.append(node);
  });
  stage.replaceChildren(prompt, options);
  announce(poll.title);
}
function openResults() {
  if (!stage || !getParticipation()?.resultsUnlocked) return;
  resultsActive = true;
  stage.closest<HTMLElement>('.enquete-screen')?.setAttribute('data-results-active', '');
  const list = el('div', 'results-list');
  list.append(el('p', 'results-intro section-content-title', 'O que a galera escolheu'));
  ranking = createResultsRanking([], reduced); list.append(ranking.element);
  resultStatus = el('p', 'results-demo', 'Carregando resultados…'); resultStatus.setAttribute('role', 'status'); list.append(resultStatus);
  stage.replaceChildren(list); void refreshResults();
}
async function refreshResults() {
  clearTimeout(timer);
  if (!resultsActive || resultsPending || document.hidden || screen?.inert || !navigator.onLine) return;
  resultsPending = true;
  try {
    const response = await api.results();
    const snapshot: PollResult[] = response.results.filter(item => item.options.length === 2).map(item => ({
      question: { id: item.pollId, prompt: item.title, options: item.options.map(option => ({ id: option.id, label: option.label, icon: '', tone: 'cream' as const })) as PollResult['question']['options'] },
      counts: [item.options[0].votes, item.options[1].votes], total: item.totalVotes,
    }));
    ranking?.update(snapshot);
    if (resultStatus) resultStatus.textContent = snapshot.length ? 'Atualizado periodicamente.' : 'Ainda não há resultados.';
  } catch {
    if (resultStatus) resultStatus.textContent = 'Não foi possível atualizar; os resultados exibidos podem estar desatualizados.';
  } finally {
    resultsPending = false;
    if (resultsActive && !document.hidden && !screen?.inert && navigator.onLine) timer = setTimeout(() => void refreshResults(), 30000);
  }
}
if (stage) {
  void load();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshResults(); else clearTimeout(timer); });
  window.addEventListener('online', () => void refreshResults());
  if (screen) new MutationObserver(() => { if (!screen.inert) void refreshResults(); else clearTimeout(timer); }).observe(screen, { attributes: true, attributeFilter: ['inert'] });
}
