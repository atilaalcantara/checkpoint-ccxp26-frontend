/** HTTP contract for the real API. */
const base = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
const visitorKey = 'checkpoint-visitor-id-v1';
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ApiImage { mediaType: string; width: number; height: number; base64: string }
export interface AssignedPoll {
  id: string; title: string; options: { id: string; label: string }[];
  answerOptionId: string | null; canVote: boolean;
}
export interface Participation {
  status: 'ready' | 'waiting_for_polls' | 'completed';
  requiredPollCount: number; assignedPollCount: number; answeredPollCount: number;
  resultsUnlocked: boolean; photoStatus: 'not_submitted' | 'submitted'; polls: AssignedPoll[];
}
export interface Community { totalXp: number; revision: string }
export interface Progress extends Community {
  updatedAtUtc: string;
  currentLevel: { id: string; name: string; minimumXp: number; nextLevelAtXp: number | null;
    isFinal: boolean; artVersion: string; characters: (ApiImage & { role: string })[] };
  previousLevels: { id: string; name: string; minimumXp: number }[];
}
export interface Results {
  asOfUtc: string;
  results: { pollId: string; title: string; totalVotes: number; options: { id: string; label: string; votes: number }[] }[];
}
export interface RecentPhotos {
  updatedAtUtc: string; photos: { id: string; createdAtUtc: string; alt: string; image: ApiImage }[];
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter: string | null) {
    super(message);
  }
}

/** Writes must not proceed if the visitor identity cannot be saved and read back. */
export function visitorId(): string {
  try {
    const existing = localStorage.getItem(visitorKey);
    if (existing && uuidV4.test(existing)) {
      localStorage.setItem(visitorKey, existing);
      if (localStorage.getItem(visitorKey) !== existing) throw new Error('Identificador não persistido');
      return existing;
    }
    if (existing) throw new Error('Identificador inválido');
    const id = crypto.randomUUID();
    localStorage.setItem(visitorKey, id);
    if (localStorage.getItem(visitorKey) !== id) throw new Error('Identificador não persistido');
    return id;
  } catch {
    throw new Error('Não foi possível guardar sua identificação neste navegador. Não podemos garantir a continuidade da participação.');
  }
}

async function request<T>(path: string, options: RequestInit = {}, identified = false): Promise<T> {
  const headers = new Headers(options.headers);
  if (identified) headers.set('X-Visitor-Id', visitorId());
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 60000);
  try {
    const response = await fetch(`${base}/api/v1${path}`, { ...options, signal: controller.signal, headers, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      if (body?.error?.code === 'SITE_NOT_LIVE') window.dispatchEvent(new Event('checkpoint:site-status'));
      throw new ApiError(response.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? 'Serviço temporariamente indisponível.', response.headers.get('Retry-After'));
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export const api = {
  participation: () => request<Participation>('/participation', { method: 'PUT' }, true),
  progress: () => request<Progress>('/progress'),
  results: () => request<Results>('/results', {}, true),
  recentPhotos: () => request<RecentPhotos>('/photos/recent'),
  vote: (pollId: string, optionId: string) => request<{ pollId: string; optionId: string; awardedXp: number; resultsUnlocked: boolean; community: Community }>('/votes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pollId, optionId }),
  }, true),
  photo: (file: File, signal?: AbortSignal) => {
    const body = new FormData(); body.append('file', file);
    return request<{ photoId: string; photoStatus: 'submitted'; awardedXp: number; community: Community }>('/photos', { method: 'POST', body, signal }, true);
  },
};
