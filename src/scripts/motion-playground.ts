import { activate } from './defer-images';

type Scene = 'korok' | 'photos' | 'quiz' | 'level';
const variants: Record<Scene, { name: string; description: string }[]> = {
  korok: [
    { name: 'A1 · Peek & Pop', description: 'Uma espiada, uma pequena surpresa e, por fim, o balão.' },
    { name: 'A2 · Little Hop', description: 'Um salto curto em arco, seguido de uma aterrissagem leve.' },
    { name: 'A3 · Dialogue Reveal', description: 'O mascote espera enquanto o diálogo se abre a partir dele.' },
  ],
  photos: [
    { name: 'B1 · Card Fan', description: 'As lembranças se abrem de uma pilha para o leque aprovado.' },
    { name: 'B2 · Photo Drop', description: 'Cada fotografia é colocada delicadamente sobre a mesa.' },
    { name: 'B3 · Memory Spread', description: 'Movimentos sobrepostos organizam as fotos com naturalidade.' },
  ],
  quiz: [
    { name: 'C1 · Duel Entrance', description: 'Dois lados entram em cena, como um duelo amigável.' },
    { name: 'C2 · Anticipation & Settle', description: 'Dois cartões se preparam e se acomodam com peso sutil.' },
    { name: 'C3 · Staggered Reveal', description: 'A pergunta guia o olhar antes das opções.' },
  ],
  level: [{ name: 'D1 · Pixel Reveal', description: 'Conceito: progresso completo e revelação com os mesmos sprites.' }],
};
const durations: Record<Scene, number> = { korok: 650, photos: 600, quiz: 550, level: 850 };
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const experiment = $<HTMLSelectElement>('#experiment');
const variant = $<HTMLSelectElement>('#variant');
const duration = $<HTMLInputElement>('#duration');
const distance = $<HTMLInputElement>('#distance');
const settle = $<HTMLInputElement>('#settle');
const delay = $<HTMLInputElement>('#delay');
const reduce = $<HTMLInputElement>('#reduce');
const system = matchMedia('(prefers-reduced-motion: reduce)');
const stage = $<HTMLElement>('#stage');
const active = new Set<Animation>();
let run = 0;
let timers: number[] = [];

activate(stage);
function reset(): void {
  run++;
  for (const animation of active) animation.cancel();
  active.clear();
  timers.forEach(clearTimeout); timers = [];
  stage.querySelectorAll('[data-selected]').forEach(element => element.removeAttribute('data-selected'));
  $<HTMLElement>('[data-level]').textContent = '01';
}
function currentScene(): Scene { return experiment.value as Scene; }
function update(): void {
  const scene = currentScene();
  const choice = variants[scene][Number(variant.value)] || variants[scene][0];
  $<HTMLElement>('#current-label').textContent = choice.name;
  $<HTMLElement>('#description').textContent = choice.description;
  $<HTMLElement>('#duration-value').textContent = `${duration.value} ms`;
  $<HTMLElement>('#distance-value').textContent = `${distance.value}%`;
  $<HTMLElement>('#settle-value').textContent = `${settle.value}%`;
  $<HTMLElement>('#delay-value').textContent = `${delay.value} ms`;
  $<HTMLElement>('#system-reduce').hidden = !system.matches;
  stage.querySelectorAll<HTMLElement>('[data-scene]').forEach(element => { element.hidden = element.dataset.scene !== scene; });
}
function chooseScene(): void {
  reset();
  const scene = currentScene();
  variant.replaceChildren(...variants[scene].map((item, index) => new Option(item.name, String(index))));
  duration.value = String(durations[scene]);
  update();
}
function play(): void {
  reset(); update();
  if (reduce.checked || system.matches || document.hidden) return;
  const ticket = run;
  const scene = currentScene();
  const selection = Number(variant.value);
  const ms = Number(duration.value);
  const d = Number(distance.value) / 100;
  const s = Number(settle.value) / 100;
  const lag = Number(delay.value);
  const root = stage.querySelector<HTMLElement>(`[data-scene="${scene}"]`)!;
  const el = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  const animate = (target: HTMLElement, frames: Keyframe[], time = ms, wait = 0, easing = 'cubic-bezier(.22,.75,.25,1)') => {
    const effect = target.animate(frames, { duration: time, delay: wait, easing, fill: 'backwards' });
    active.add(effect);
    effect.finished.then(() => { if (run === ticket) effect.cancel(); }).catch(() => {}).finally(() => active.delete(effect));
  };
  if (scene === 'korok') {
    const mascot = el('.mascot img'), bubble = el('.speech-bubble'), text = el('.mascot-message');
    if (selection === 0) animate(mascot, [
      { transform: `translateY(${45*d}px)` }, { transform: `translateY(${50*d}px)`, offset:.18 },
      { transform:`translateY(${-5*s}px)`, offset:.68 }, { transform:'translateY(0)' },
    ]);
    if (selection === 1) animate(mascot, [
      { transform:'translate(0, 0)' }, { transform:`translate(0, ${4*d}px)`, offset:.16 },
      { transform:`translate(${5*d}px, ${-25*d}px)`, offset:.5 }, { transform:`translate(${2*d}px, ${2*s}px)`, offset:.8 }, { transform:'translate(0, 0)' },
    ]);
    bubble.style.transformOrigin = 'left center';
    animate(bubble, [{ opacity:0, transform:'scale(.82)' }, { opacity:1, transform:`scale(${1 + .025*s})`, offset:.75 }, { opacity:1, transform:'scale(1)' }], ms*.6, selection === 2 ? 0 : ms*.58 + lag);
    animate(text, [{ opacity:0 }, { opacity:0, offset:.4 }, { opacity:1 }], ms*.6, selection === 2 ? 0 : ms*.58 + lag);
  } else if (scene === 'photos') {
    const left = el('.fan-item--left'), right = el('.fan-item--right'), center = el('.fan-item--center');
    const spread = root.querySelector<HTMLElement>('.recent-photos')!.clientWidth * .23 * d;
    const card = (target: HTMLElement, side: number, wait: number) => {
      const rest = getComputedStyle(target).transform;
      let frames: Keyframe[];
      if (selection === 0) frames = [
        { opacity:.8, transform:`translate(${-side*spread}px, ${7*d}px) ${rest} rotate(${-side*10*d}deg)` },
        { opacity:1, transform:`translate(${side*3*s}px, ${-3*d}px) ${rest} rotate(${side*1.5*s}deg)`, offset:.78 },
        { opacity:1, transform:rest },
      ];
      else if (selection === 1) frames = [
        { opacity:0, transform:`translate(${side*8*d}px, ${-26*d}px) ${rest} rotate(${side*4*d}deg)` },
        { opacity:1, transform:`translate(${side*7*d}px, ${-24*d}px) ${rest} rotate(${side*3.5*d}deg)`, offset:.08 },
        { opacity:1, transform:`translate(0, ${3*s}px) ${rest}`, offset:.78 }, { opacity:1, transform:rest },
      ];
      else frames = [
        { opacity:.8, transform:`translate(${-side*spread*.65}px, ${5*d}px) ${rest} rotate(${-side*5*d}deg)` },
        { opacity:1, transform:`translate(${side*2*s}px, ${-2*d}px) ${rest}`, offset:.8 }, { opacity:1, transform:rest },
      ];
      animate(target, frames, ms, wait);
    };
    card(left, -1, 0); card(right, 1, selection === 1 ? lag : lag*.45); card(center, 0, selection === 1 ? lag*2 : lag*.7);
  } else if (scene === 'quiz') {
    const prompt = el('.quiz-prompt'), options = [...root.querySelectorAll<HTMLElement>('.quiz-option')];
    if (selection === 2) animate(prompt, [{ opacity:0, transform:'translateY(5px)' }, { opacity:1, transform:'translateY(0)' }], ms*.65);
    options.forEach((option, i) => {
      let frames: Keyframe[];
      if (selection === 0) frames = [{ opacity:0, transform:`translateX(${(i ? 1 : -1)*38*d}px)` }, { opacity:1, transform:`translateX(${(i ? -1 : 1)*2*s}px)`, offset:.82 }, { opacity:1, transform:'translateX(0)' }];
      else if (selection === 1) frames = [{ opacity:.45, transform:`translateY(${-4*d}px)` }, { opacity:1, transform:`translateY(${3*s}px)`, offset:.72 }, { opacity:1, transform:'translateY(0)' }];
      else frames = [{ opacity:0, transform:`translateY(${12*d}px) scale(.97)` }, { opacity:1, transform:'translateY(0) scale(1)' }];
      animate(option, frames, ms, (selection === 2 ? ms*.3 : 0) + i*lag);
    });
  } else {
    const fill = el('.demo-fill'), marker = el('.demo-marker');
    animate(fill, [{ transform:'scaleX(.65)' }, { transform:'scaleX(1)' }], ms*.42);
    const markerStart = el('.demo-track').clientWidth * .35;
    animate(marker, [{ transform:`translate(${-markerStart}px,-50%)` }, { transform:`translate(${3*s}px,-50%)`, offset:.8 }, { transform:'translate(0,-50%)' }], ms*.44);
    const tiles = [...root.querySelectorAll<HTMLElement>('.pixel-grid span')];
    tiles.forEach((tile, index) => {
      const offset = ((index % 8) + Math.floor(index / 8)) / 14;
      animate(tile, [{ opacity:0 }, { opacity:1, offset:.3 }, { opacity:1, offset:.55 }, { opacity:0 }], ms*.5, ms*.32 + offset * lag);
    });
    timers.push(window.setTimeout(() => { if (run === ticket) el('[data-level]').textContent = '02'; }, ms*.72 + lag));
  }
}
experiment.addEventListener('change', chooseScene);
variant.addEventListener('change', () => { reset(); update(); });
for (const control of [duration, distance, settle, delay, reduce]) control.addEventListener('input', () => { reset(); update(); });
$<HTMLButtonElement>('#play').addEventListener('click', () => {
  if (matchMedia('(max-width: 700px)').matches) stage.scrollIntoView({ behavior: 'instant', block: 'center' });
  play();
});
$<HTMLButtonElement>('#cancel').addEventListener('click', reset);
stage.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach(option => option.addEventListener('click', () => {
  reset(); option.dataset.selected = '';
  timers.push(window.setTimeout(() => option.removeAttribute('data-selected'), 160));
}));
system.addEventListener('change', () => { reset(); update(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
window.addEventListener('blur', reset);
chooseScene();
