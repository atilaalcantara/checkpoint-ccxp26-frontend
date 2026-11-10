import { refreshCommunityXP, subscribeCommunityXP } from './community-xp';
import type { Progress } from './api';

const container = document.querySelector<HTMLElement>('[data-community-progress]');
const stage = document.querySelector<HTMLElement>('.character-stage');
let version = 0;
let displayed: Progress | null = null;

async function render(progress: Progress) {
  if (!container || !stage) return;
  const ticket = ++version;
  const layer = document.createElement('div');
  layer.className = 'character-composition';
  layer.dataset.characterComposition = '';
  layer.dataset.current = '';
  const images = progress.currentLevel.characters.map(character => {
    if (character.mediaType !== 'image/avif' || !/^[A-Za-z0-9+/]*={0,2}$/.test(character.base64)) throw new Error('Arte inválida');
    const image = document.createElement('img');
    image.className = `character character-${character.role}`;
    image.width = character.width; image.height = character.height;
    image.alt = `${character.role === 'couple' ? 'Juh e Átila' : character.role === 'juh' ? 'Juh' : 'Átila'}: ${progress.currentLevel.name}`;
    image.src = `data:image/avif;base64,${character.base64}`;
    layer.append(image); return image;
  });
  await Promise.all(images.map(image => image.decode()));
  if (ticket !== version) return;
  const level = progress.currentLevel;
  const required = level.nextLevelAtXp === null ? 0 : level.nextLevelAtXp - level.minimumXp;
  const earned = Math.max(0, progress.totalXp - level.minimumXp);
  const percent = level.isFinal ? 100 : Math.max(0, Math.min(100, required ? earned / required * 100 : 0));
  container.querySelector<HTMLElement>('[data-level-name]')!.textContent = level.name;
  container.querySelector<HTMLElement>('[data-level-points]')!.textContent = level.isFinal ? 'Concluído' : `${earned} / ${required} XP`;
  const bar = container.querySelector<HTMLProgressElement>('progress')!;
  bar.max = level.isFinal ? 1 : required; bar.value = level.isFinal ? 1 : earned;
  bar.setAttribute('aria-valuetext', level.isFinal ? `${level.name}, evolução concluída` : `${earned} de ${required} XP`);
  container.querySelector<HTMLElement>('.progress-track')!.style.setProperty('--progress-position', `${percent}%`);
  container.querySelector<HTMLElement>('[data-progress-fill]')!.style.transform = `scaleX(${percent / 100})`;
  stage.replaceChildren(layer);
  displayed = progress;
}
if (container && stage) {
  stage.replaceChildren();
  const note = container.querySelector<HTMLElement>('.progress-note');
  subscribeCommunityXP((progress, stale) => {
    if (note) note.textContent = stale ? (displayed ? 'Progresso pode estar desatualizado.' : 'Progresso indisponível no momento.') : 'Progresso da comunidade';
    if (progress) void render(progress).catch(() => { if (note) note.textContent = 'Não foi possível carregar a arte atual.'; });
  });
  void refreshCommunityXP();
  window.addEventListener('online', () => void refreshCommunityXP());
}
