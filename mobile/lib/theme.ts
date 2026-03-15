export const colors = {
  background: '#0f0e2a',
  card: 'rgba(22, 20, 58, 0.6)',
  cardSolid: '#16143a',
  elevated: '#1e1b4b',
  border: 'rgba(99, 102, 241, 0.15)',
  borderHighlight: 'rgba(99, 102, 241, 0.4)',

  white: '#ffffff',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  textDim: '#334155',

  indigo: {
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    900: '#1e1b4b',
  },
  purple: {
    500: '#a855f7',
    600: '#9333ea',
  },
  cyan: {
    400: '#22d3ee',
    500: '#06b6d4',
  },
  green: {
    500: '#22c55e',
  },
  red: {
    300: '#fca5a5',
    400: '#f87171',
    800: 'rgba(153, 27, 27, 0.4)',
    900: 'rgba(127, 29, 29, 0.2)',
  },
  yellow: {
    400: '#facc15',
  },
  slate: {
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: 'rgba(30, 41, 59, 0.8)',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
