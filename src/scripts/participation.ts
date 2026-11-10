import { api, type Participation } from './api';

let current: Participation | null = null;
let pending: Promise<Participation> | null = null;
const listeners = new Set<(state: Participation) => void>();

export function getParticipation() { return current; }
export function subscribeParticipation(listener: (state: Participation) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function refreshParticipation(): Promise<Participation> {
  if (pending) return pending;
  pending = api.participation().then(state => {
    current = state;
    listeners.forEach(listener => listener(state));
    return state;
  }).finally(() => { pending = null; });
  return pending;
}
