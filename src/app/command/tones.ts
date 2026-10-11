// Command's colours, in Kisan Saathi's soft style: a pale wash, a thin edge and dark ink for good,
// caution and trouble, instead of solid blocks of colour.
import type { CaseSummary } from './commandApi';

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export const TONE: Record<Tone, { ink: string; wash: string; edge: string }> = {
  good: { ink: '#15803d', wash: '#f0fdf4', edge: '#bbf7d0' },
  warn: { ink: '#b45309', wash: '#fffbeb', edge: '#fde68a' },
  bad: { ink: '#b91c1c', wash: '#fef2f2', edge: '#fecaca' },
  neutral: { ink: '#334155', wash: '#f8fafc', edge: '#e2e8f0' },
};

/** Pin colours on the map. */
export const PIN_COLOURS = {
  report: '#dc2626',
  help: '#16a34a',
  farm: '#16a34a',
  chc: '#2563eb',
  fire: '#f97316',
  closed: '#94a3b8',
} as const;

/** Escalated is trouble, a farmer's help request is the good path, closed is quiet; the rest need care. */
export function caseTone(s: Pick<CaseSummary, 'escalatedAt' | 'hasHelpRequest' | 'case'>): Tone {
  if (s.case.status === 'CLOSED') return 'neutral';
  if (s.escalatedAt) return 'bad';
  if (s.hasHelpRequest) return 'good';
  return 'warn';
}
