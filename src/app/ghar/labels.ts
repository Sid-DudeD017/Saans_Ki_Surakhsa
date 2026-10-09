// TODO(P2 labels.ts): Replace with imported labels when available.
export const CATEGORY_LABELS: Record<string, string> = {
  good: 'Good',
  satisfactory: 'Satisfactory',
  moderate: 'Moderate',
  poor: 'Poor',
  very_poor: 'Very poor',
  severe: 'Severe',
};

export const CATEGORY_COLORS: Record<string, string> = {
  good: '#16a34a', // green
  satisfactory: '#84cc16', // light green
  moderate: '#eab308', // yellow
  poor: '#f97316', // orange
  very_poor: '#ef4444', // red
  severe: '#b91c1c', // dark red
};

export function getPm25Category(val: number): string {
  if (val <= 30) return 'good';
  if (val <= 60) return 'satisfactory';
  if (val <= 90) return 'moderate';
  if (val <= 120) return 'poor';
  if (val <= 250) return 'very_poor';
  return 'severe';
}
