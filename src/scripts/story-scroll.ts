// Relógio único da home animada (_index.launch.astro).
// Um rAF lê a geometria real da pista e escreve variáveis CSS; o CSS é dono de
// transform/opacity. Reverter o scroll retraça a coreografia. Movimento reduzido
// e falhas deixam a composição estática completa (nada fica `hidden`).
import { screenEntrances } from './screen-entrance';
import { activate } from './defer-images';
import { getParticipation, subscribeParticipation } from './participation';

const root = document.documentElement;
const story = document.querySelector<HTMLElement>('[data-story]');
const track = document.querySelector<HTMLElement>('[data-story-track]');
const stage = document.querySelector<HTMLElement>('[data-story-stage]');
const chapters = [...document.querySelectorAll<HTMLElement>('.chapter')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function updateGuideState(): void {
  if (!story) return;
  const participation = getParticipation();
  story.toggleAttribute('data-poll-complete', participation?.resultsUnlocked === true);
  story.toggleAttribute('data-photo-submitted', participation?.photoStatus === 'submitted');
}
subscribeParticipation(updateGuideState);
updateGuideState();

if (story && reduce.matches) {
  const phaseObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) story.dataset.phase = String(chapters.indexOf(entry.target as HTMLElement) + 1);
  }, { threshold: 0.5 });
  chapters.forEach(chapter => phaseObserver.observe(chapter));
}

const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
const smooth = (t: number): number => t * t * (3 - 2 * t);
const easeOutBack = (t: number): number => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const seg = (p: number, a: number, b: number): number => smooth(clamp((p - a) / (b - a)));

// Imagens adiadas (SectionHeader) ativam perto da vista; o app original fazia o mesmo por tela.
const lazy = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { activate(e.target); lazy.unobserve(e.target); }
}, { rootMargin: '60% 0px' });
chapters.forEach(c => lazy.observe(c));

const entrances = screenEntrances(reduce);
entrances.prepare(chapters);
chapters.forEach(chapter => {
  chapter.addEventListener('pointerdown', () => entrances.dismiss(chapter), { passive: true });
  chapter.addEventListener('keydown', () => entrances.dismiss(chapter));
});
const reveal = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    entrances.present(e.target as HTMLElement);
    reveal.unobserve(e.target);
  }
}, { threshold: 0.4 });
chapters.forEach(c => reveal.observe(c));

if (story && track && stage && !reduce.matches) {
  story.classList.add('story-on');
  let frame = 0;
  let lastY = scrollY;
  let walkTimer = 0;
  let currentPhase = -1;
  let guideTimer = 0;
  const dockLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-dock-link]')];
  const guide = document.querySelector<HTMLElement>('[data-guide]');
  const guideText = document.querySelector<HTMLElement>('[data-guide-text]');
  const guideBubble = document.querySelector<HTMLElement>('[data-guide-bubble]');
  const guideKorok = document.querySelector<HTMLElement>('[data-guide-toggle] img');
  // Frases já existentes no texto do app, uma por fase.
  const lines = ['Role para baixo e comece!', 'Toque no seu lado: +1 XP!', 'Mande uma foto: +2 XP!'];

  function openGuide(): void {
    if (!guide) return;
    guide.setAttribute('data-open', '');
    guideBubble?.removeAttribute('data-pop');
    void guideBubble?.offsetWidth;
    guideBubble?.setAttribute('data-pop', '');
    clearTimeout(guideTimer);
    guideTimer = window.setTimeout(() => guide.removeAttribute('data-open'), 4200);
  }
  function setPhase(i: number): void {
    const first = currentPhase === -1;
    currentPhase = i;
    story!.dataset.phase = String(i);
    dockLinks.forEach((a, n) => n === i ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    if (guideText) guideText.textContent = lines[i] ?? lines[0];
    if (first) return;
    // Korok dá um pulinho (anticipation + follow-through) e fala a frase da fase.
    guideKorok?.animate([
      { transform: 'translateY(0) scaleY(1)' }, { transform: 'translateY(2px) scaleY(.9)', offset: .2 },
      { transform: 'translateY(-12px) scaleY(1.06)', offset: .55 }, { transform: 'translateY(0) scaleY(1)' },
    ], { duration: 480, easing: 'cubic-bezier(.34,1.4,.64,1)' });
    openGuide();
  }
  document.querySelector('[data-guide-toggle]')?.addEventListener('click', () => {
    if (guide?.hasAttribute('data-open')) { clearTimeout(guideTimer); guide.removeAttribute('data-open'); } else openGuide();
  });
  // Primeira fala quando o Korok aparece no fim da cena.
  let intro = false;

  const update = (): void => {
    frame = 0;
    const rect = track.getBoundingClientRect();
    const span = Math.max(1, rect.height - innerHeight);
    const p = clamp(-rect.top / span);

    // Coreografia (progresso 0–1 da pista): abertura • dolly • retenção legível • saída
    const cam = seg(p, 0.1, 0.62);
    const set = (k: string, v: number): void => story.style.setProperty(k, v.toFixed(4));
    set('--cam', cam);
    set('--lift', seg(p, 0.3, 0.62));
    set('--logo', seg(p, 0.05, 0.28));
    // Medidas do estado final: a placa nunca passa do topo (-64px reservados p/ o botão "i").
    const box = stage.querySelector<HTMLElement>('.scene-box');
    const plate = stage.querySelector<HTMLElement>('.plate');
    const chars = stage.querySelector<HTMLElement>('.character-stage');
    if (box && plate && chars) {
      const feet = box.offsetTop + box.offsetHeight * 0.94;
      const H = chars.offsetHeight;
      const zmax = Math.max(0, Math.min(0.32, (feet - H - plate.offsetHeight - 72) / H));
      const head = feet - H * (1 + zmax);
      const room = head - plate.offsetHeight - 8 - 64;
      const shift = Math.max(0, Math.min(innerHeight * 0.1, room));
      const natural = box.offsetTop - shift + plate.offsetTop;
      const target = Math.max(head - shift - plate.offsetHeight - 8, 64);
      story.style.setProperty('--zmax', zmax.toFixed(3));
      story.style.setProperty('--shift', `${shift.toFixed(1)}px`);
      story.style.setProperty('--lift-dist', `${(natural - target).toFixed(1)}px`);
    }
    const cap = seg(p, 0.6, 0.76);
    set('--cap', cap);
    set('--pop', easeOutBack(clamp((p - 0.6) / 0.16)));
    set('--drift', p);
    set('--hud', p < 0.5 ? 0 : seg(p, 0.5, 0.6));
    if (!intro && p > 0.62) { intro = true; openGuide(); }

    // O céu vai do creme ao lilás conforme descemos pelos capítulos.
    const trackEnd = rect.bottom + scrollY;
    root.style.setProperty('--tint', (clamp((scrollY - trackEnd + innerHeight) / (innerHeight * 2.4)) * 0.85).toFixed(3));

    // Fase ativa: a que ocupa o meio da tela. Alimenta doca e Korok.
    let phase = 0;
    chapters.forEach((c, i) => { if (c.getBoundingClientRect().top <= innerHeight * 0.5) phase = i + 1; });
    if (phase !== currentPhase) setPhase(phase);

    // Os passos só acontecem enquanto a câmera se move.
    const moved = Math.abs(scrollY - lastY) > 0.5;
    lastY = scrollY;
    if (moved && p > 0.1 && p < 0.64) {
      stage.dataset.walking = '';
      clearTimeout(walkTimer);
      walkTimer = window.setTimeout(() => delete stage.dataset.walking, 160);
    }
  };
  // ── Paradas por fase ──────────────────────────────────────────────────────
  // Parada direcional: depois que o scroll assenta entre duas fases, vai para a
  // fase na direção do gesto (ou volta, se o gesto foi curto). Telas mais altas
  // que a janela rolam livres por dentro; só as transições são "imantadas".
  let touching = false;
  let programmatic = false;
  let settleTimer = 0;
  let direction = 1;
  const stops = (): number[][] => {
    const vh = innerHeight;
    const trackTop = track.getBoundingClientRect().top + scrollY;
    const heroEnd = trackTop + track.offsetHeight - vh;
    const tops = chapters.map(c => c.getBoundingClientRect().top + scrollY);
    // Pontos de repouso da abertura: 0 (logo) e HOLD (card no alto + Korok falando).
    // Qualquer parada entre eles, ou depois, é puxada para o ponto seguinte/anterior.
    const hold = trackTop + (heroEnd - trackTop) * 0.8;
    const gaps = [[trackTop, hold], [hold, tops[0]]];
    chapters.forEach((c, i) => { if (i < chapters.length - 1) gaps.push([tops[i] + c.offsetHeight - vh, tops[i + 1]]); });
    return gaps.filter(([a, b]) => b - a > 8);
  };
  const settle = (): void => {
    if (touching || programmatic || document.querySelector('dialog[open]')) return;
    const y = scrollY;
    const gap = stops().find(([a, b]) => y > a + 2 && y < b - 2);
    if (!gap) return;
    const [a, b] = gap;
    // Qualquer gesto claro (> 40px) avança na direção; um toque mínimo volta.
    const target = direction > 0 ? (y - a > 24 ? b : a) : (b - y > 24 ? a : b);
    programmatic = true;
    scrollTo({ top: target, behavior: 'smooth' });
    // Se o usuário interromper o movimento (o navegador cancela o smooth), reavalia depois de liberar.
    const release = (): void => { programmatic = false; clearTimeout(settleTimer); settleTimer = window.setTimeout(settle, 140); };
    let lastSeen = -1, still = 0;
    const watch = (): void => {
      if (scrollY === lastSeen) { if (++still > 4) return release(); } else { still = 0; lastSeen = scrollY; }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  };
  addEventListener('touchstart', () => { touching = true; programmatic = false; clearTimeout(settleTimer); }, { passive: true });
  addEventListener('touchend', () => { touching = false; settleTimer = window.setTimeout(settle, 160); }, { passive: true });
  addEventListener('touchcancel', () => { touching = false; }, { passive: true });
  addEventListener('scroll', () => {
    const d = scrollY - lastScrollY;
    lastScrollY = scrollY;
    if (programmatic) return;
    if (Math.abs(d) > 0.5) direction = d > 0 ? 1 : -1;
    clearTimeout(settleTimer);
    if (!touching) settleTimer = window.setTimeout(settle, 170);
  }, { passive: true });
  let lastScrollY = scrollY;
  // Rede de segurança: ao fim de qualquer rolagem, se ficou entre duas fases, completa.
  addEventListener('scrollend', () => { if (!touching && !programmatic) { clearTimeout(settleTimer); settleTimer = window.setTimeout(settle, 60); } });

  const schedule = (): void => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  update();

  // Abertura: o logo cai, Juh e Átila entram em sequência (ease-out-back curto).
  if (scrollY < 40) {
    const enter = (el: Element | null, delay: number, y: number): void => {
      el?.animate([{ opacity: 0, transform: `translateY(${y}px) scale(.94)` }, { opacity: 1, transform: 'none' }],
        { duration: 620, delay, easing: 'cubic-bezier(.34,1.4,.64,1)', fill: 'backwards' });
    };
    enter(stage.querySelector('.brand-image'), 0, -18);
    enter(stage.querySelector('.subtitle'), 140, -10);
    enter(stage.querySelector('.character-juh'), 260, 14);
    enter(stage.querySelector('.character-atila'), 380, 14);
    enter(stage.querySelector('.scroll-hint'), 700, 10);
  }
}
