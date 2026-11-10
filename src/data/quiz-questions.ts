export interface QuizOption {
  id: string;
  label: string;
  /** Inline SVG path/shape markup (Lucide, stroke style matching the rest of the app). */
  icon: string;
  /** One of the design system's accent tones — see QuizCard.astro's scoped styles. */
  tone: 'olive' | 'amber' | 'lavender' | 'cream';
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: [QuizOption, QuizOption];
}

const WAND = '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4m14 4v4M10 2v2M7 8H3m18 8h-4M11 3H9" />';
const FLAME = '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5" />';
const BEEF = '<g><path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3" /><path d="m18.5 6 1.754 3.5a6.48 6.48 0 0 1-1.854 8.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5" /><circle cx="12.5" cy="8.5" r="2.5" /></g>';
const EGG = '<path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12" />';
const PALMTREE = '<g><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1l1 1h4m3-.86A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1l-1 1h-3" /><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25l.7-.7l.71-.71l2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35" /><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14" /></g>';
const MOUNTAIN = '<path d="m8 3 4 8 5-5 5 15H2z" />';
const COFFEE = '<path d="M10 2v2m4-2v2m2 4a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2" />';
const LEAF = '<g><path d="M11 20a10 10 0 0 0 10-10a25.9 25.9 0 0 0-1.04-7.281a1 1 0 0 0-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0 0 11 20" /><path d="M2 21a5 5 0 0 1 2.911-4.544C7.613 15.212 8.351 15.24 11 13" /></g>';
const COOKIE = '<path d="M11 17h.01m.486-15c.324-.016.558.292.529.615a4 4 0 0 0 4.235 4.368a.713.713 0 0 1 .758.757a4 4 0 0 0 4.366 4.237c.323-.03.63.204.614.527a10 10 0 0 1-2.915 6.566A1 1 0 1 1 4.93 4.918A10 10 0 0 1 11.496 2M12 12h.01M16 16h.01M16 3h.01M21 4h.01M21 8h.01M7 14h.01M9 8h.01" />';
const UTENSILS = '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20m14-7V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2zm0 0v7" />';

/**
 * DEMO-ONLY placeholder questions (design.markdown §4.3 / ASSET_OPTIMIZATION.md).
 * There is no poll backend yet — each tap just advances locally through this
 * fixed, pre-loaded list so the sequential "tap to advance" flow can be
 * reviewed and tested. Replace with the real question(s) returned by the
 * ASP.NET Core API once it exists; `QuizCard.astro`/`src/scripts/quiz.ts`
 * don't assume a fixed length.
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'luta',
    prompt: 'Quem venceria numa luta?',
    options: [
      { id: 'harry-potter', label: 'Harry Potter', icon: WAND, tone: 'lavender' },
      { id: 'arthur-morgan', label: 'Arthur Morgan', icon: FLAME, tone: 'olive' },
    ],
  },
  {
    id: 'pizza',
    prompt: 'Pizza preferida?',
    options: [
      { id: 'calabresa', label: 'Calabresa', icon: BEEF, tone: 'amber' },
      { id: 'portuguesa', label: 'Portuguesa', icon: EGG, tone: 'olive' },
    ],
  },
  {
    id: 'destino',
    prompt: 'Praia ou montanha?',
    options: [
      { id: 'praia', label: 'Praia', icon: PALMTREE, tone: 'lavender' },
      { id: 'montanha', label: 'Montanha', icon: MOUNTAIN, tone: 'amber' },
    ],
  },
  {
    id: 'bebida',
    prompt: 'Café ou chá?',
    options: [
      { id: 'cafe', label: 'Café', icon: COFFEE, tone: 'cream' },
      { id: 'cha', label: 'Chá', icon: LEAF, tone: 'olive' },
    ],
  },
  {
    id: 'lanche',
    prompt: 'Doce ou salgado?',
    options: [
      { id: 'doce', label: 'Doce', icon: COOKIE, tone: 'amber' },
      { id: 'salgado', label: 'Salgado', icon: UTENSILS, tone: 'lavender' },
    ],
  },
  { id: 'saga', prompt: 'Qual saga merece maratona?', options: [
    { id: 'aneis', label: 'Senhor dos Anéis', icon: WAND, tone: 'olive' },
    { id: 'estrelas', label: 'Star Wars', icon: FLAME, tone: 'lavender' },
  ] },
  { id: 'jogo', prompt: 'Qual jogo para jogar junto?', options: [
    { id: 'mario', label: 'Mario Kart', icon: FLAME, tone: 'amber' },
    { id: 'stardew', label: 'Stardew Valley', icon: LEAF, tone: 'olive' },
  ] },
  { id: 'heroi', prompt: 'Qual herói salva o encontro?', options: [
    { id: 'aranha', label: 'Homem-Aranha', icon: WAND, tone: 'lavender' },
    { id: 'mulher-maravilha', label: 'Mulher-Maravilha', icon: FLAME, tone: 'amber' },
  ] },
  { id: 'filme', prompt: 'Filme do casal: qual gênero?', options: [
    { id: 'aventura', label: 'Aventura', icon: MOUNTAIN, tone: 'olive' },
    { id: 'comedia', label: 'Comédia', icon: COOKIE, tone: 'cream' },
  ] },
  { id: 'controle', prompt: 'Quem escolhe o próximo jogo?', options: [
    { id: 'eu', label: 'Eu escolho', icon: WAND, tone: 'lavender' },
    { id: 'voce', label: 'Você escolhe', icon: FLAME, tone: 'amber' },
  ] },
];
