import { api, type Progress } from './api';
import { showXPFeedback } from './xp-feedback';

let latest: Progress | null = null;
const listeners = new Set<(value: Progress | null, stale: boolean) => void>();
export function subscribeCommunityXP(listener: (value: Progress | null, stale: boolean) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export async function refreshCommunityXP() {
  try {
    const next = await api.progress();
    if (!/^\d+$/.test(next.revision)) throw new Error('Revisão inválida');
    if (!latest || BigInt(next.revision) >= BigInt(latest.revision)) {
      latest = next;
      listeners.forEach(listener => listener(latest, false));
    }
  } catch { listeners.forEach(listener => listener(latest, true)); }
}
export function showConfirmedXP(awardedXp: number) {
  if (Number.isSafeInteger(awardedXp) && awardedXp > 0) showXPFeedback(awardedXp);
  void refreshCommunityXP();
}
