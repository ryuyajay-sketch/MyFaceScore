export type Context = 'professional' | 'dating' | 'social';

export const CONTEXTS = [
  { id: 'professional' as Context, label: 'Professional', emoji: 'P', desc: 'LinkedIn, r\u00e9sum\u00e9, job applications' },
  { id: 'dating' as Context, label: 'Dating', emoji: 'D', desc: 'Dating apps, social profiles' },
  { id: 'social' as Context, label: 'Social', emoji: 'S', desc: 'Instagram, general social media' },
] as const;

export const DIMENSIONS = [
  { label: 'Trustworthiness', value: 84, color: '#06b6d4', icon: 'T' },
  { label: 'Competence',      value: 77, color: '#6366f1', icon: 'C' },
  { label: 'Approachability', value: 91, color: '#22c55e', icon: 'A' },
  { label: 'Attractiveness',  value: 73, color: '#a855f7', icon: 'X' },
] as const;

export const DIMENSION_CONFIG = [
  {
    key: 'trustworthiness' as const,
    label: 'Trustworthiness',
    icon: 'T',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.2)',
    research: 'Dominant axis in Todorov & Oosterhof (2008)',
  },
  {
    key: 'competence' as const,
    label: 'Competence',
    icon: 'C',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.08)',
    borderColor: 'rgba(99,102,241,0.2)',
    research: 'Todorov et al. (2005) \u2014 predicts election outcomes',
  },
  {
    key: 'approachability' as const,
    label: 'Approachability',
    icon: 'A',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
    research: 'Sutherland et al. (2013) \u2014 driven by expression cues',
  },
  {
    key: 'attractiveness' as const,
    label: 'Attractiveness',
    icon: 'X',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(168,85,247,0.2)',
    research: 'Secondary dimension in Todorov face evaluation model',
  },
] as const;

export const CONTEXT_LABELS: Record<Context, string> = {
  professional: 'Professional',
  dating: 'Dating',
  social: 'Social',
};

export const STEP_LABELS: Record<string, string> = {
  queued: 'Waiting in queue\u2026',
  detecting: 'Detecting face landmarks\u2026',
  enhancing: 'Enhancing image quality\u2026',
  uploading: 'Preparing image\u2026',
  scoring: 'AI is scoring your photo\u2026',
  finalizing: 'Generating your results\u2026',
};

export function percentileLabel(p: number): string {
  if (p >= 90) return 'Top 10%';
  if (p >= 75) return 'Top 25%';
  if (p >= 50) return 'Above average';
  if (p >= 25) return 'Average';
  return 'Below average';
}
