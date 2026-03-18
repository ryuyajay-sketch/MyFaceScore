export type Context = 'professional' | 'dating' | 'social';

export const CONTEXTS = [
  { id: 'professional' as Context, label: 'Professional', emoji: '\u25B2', desc: 'LinkedIn, r\u00e9sum\u00e9, job applications' },
  { id: 'dating' as Context, label: 'Dating', emoji: '\u2665', desc: 'Dating apps, social profiles' },
  { id: 'social' as Context, label: 'Social', emoji: '\u0040', desc: 'Instagram, general social media' },
] as const;

export const DIMENSIONS = [
  { label: 'Trustworthiness', value: 82, color: '#06b6d4', icon: 'T', preview: 'Relaxed brow and soft eye contact — nothing guarded or tense here' },
  { label: 'Competence',      value: 76, color: '#6366f1', icon: 'C', preview: 'Polished but expression leans warm over authoritative' },
  { label: 'Approachability', value: 84, color: '#22c55e', icon: 'A', preview: 'That slight smirk creates a magnetic "easy to talk to" signal' },
  { label: 'Attractiveness',  value: 86, color: '#a855f7', icon: 'X', preview: 'Strong symmetry, clear skin — sharp focus with no harsh shadows' },
] as const;

export const DIMENSION_CONFIG = [
  {
    key: 'trustworthiness' as const,
    label: 'Trustworthiness',
    icon: 'T',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.2)',
    research: 'The #1 trait people judge in the first 0.1 seconds',
  },
  {
    key: 'competence' as const,
    label: 'Competence',
    icon: 'C',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.08)',
    borderColor: 'rgba(99,102,241,0.2)',
    research: 'Predicts how capable and confident you appear',
  },
  {
    key: 'approachability' as const,
    label: 'Approachability',
    icon: 'A',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
    research: 'Driven by expression, warmth, and body language cues',
  },
  {
    key: 'attractiveness' as const,
    label: 'Attractiveness',
    icon: 'X',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(168,85,247,0.2)',
    research: 'Symmetry, skin clarity, and photo quality',
  },
] as const;

export const PURPOSE_SUGGESTIONS: Record<Context, string[]> = {
  professional: ['LinkedIn profile photo', 'Job application headshot', 'How do I come across to coworkers?'],
  dating: ['Dating app main photo', 'Do I look approachable?', 'First date first impression'],
  social: ['How do others see me?', 'Profile pic check', 'Do I look trustworthy?'],
};

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
