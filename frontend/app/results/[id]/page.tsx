'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import html2canvas from 'html2canvas';
import { Share2, ArrowLeft, RefreshCw, Info } from 'lucide-react';
import Link from 'next/link';
import { getResults } from '@/lib/api';

interface Tip {
  text: string;
  category: string;
}

interface DimensionResult {
  score: number;
  percentile: number;
  analysis: string;
  tips: Tip[];
}

/** Small SVG illustrations for each tip category */
function TipIcon({ category, color }: { category: string; color: string }) {
  const props = { width: 40, height: 40, viewBox: '0 0 40 40', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };
  switch (category) {
    case 'expression':
      return (
        <svg {...props}>
          <circle cx="20" cy="20" r="16" stroke={color} strokeWidth="1.5" opacity="0.3" />
          <circle cx="14" cy="17" r="1.5" fill={color} />
          <circle cx="26" cy="17" r="1.5" fill={color} />
          <path d="M13 25c2 3 12 3 14 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'lighting':
      return (
        <svg {...props}>
          <circle cx="20" cy="20" r="8" stroke={color} strokeWidth="1.5" />
          <path d="M20 6v4M20 30v4M6 20h4M30 20h4M10.3 10.3l2.8 2.8M26.9 26.9l2.8 2.8M29.7 10.3l-2.8 2.8M13.1 26.9l-2.8 2.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'pose':
      return (
        <svg {...props}>
          <circle cx="20" cy="12" r="5" stroke={color} strokeWidth="1.5" />
          <path d="M12 36V26a8 8 0 0116 0v10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 26l-4 6M24 26l4 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'grooming':
      return (
        <svg {...props}>
          <path d="M14 8c0 0 2-2 6-2s6 2 6 2c0 4-1 8-6 10-5-2-6-6-6-10z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 28c0-4 4-7 10-7s10 3 10 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="22" r="1" fill={color} />
          <path d="M16 32h8M18 32v4M22 32v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'framing':
      return (
        <svg {...props}>
          <path d="M8 14V8h6M26 8h6v6M8 26v6h6M26 34h6v-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="20" r="6" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
        </svg>
      );
    case 'background':
      return (
        <svg {...props}>
          <rect x="6" y="6" width="28" height="28" rx="4" stroke={color} strokeWidth="1.5" />
          <path d="M6 28l8-8 6 6 4-4 10 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="28" cy="12" r="3" fill={color} opacity="0.4" />
        </svg>
      );
    case 'gaze':
      return (
        <svg {...props}>
          <ellipse cx="20" cy="20" rx="14" ry="9" stroke={color} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="5" stroke={color} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="2" fill={color} />
          <path d="M3 20h3M34 20h3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'angle':
      return (
        <svg {...props}>
          <rect x="10" y="6" width="20" height="28" rx="3" stroke={color} strokeWidth="1.5" />
          <circle cx="20" cy="16" r="4" stroke={color} strokeWidth="1.2" />
          <path d="M14 30l6-4 6 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" opacity="0.3" />
          <path d="M20 14v6M20 24v1" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  expression: 'Expression',
  lighting: 'Lighting',
  pose: 'Pose',
  grooming: 'Grooming',
  framing: 'Framing',
  background: 'Background',
  gaze: 'Eye Contact',
  angle: 'Camera Angle',
};

interface ResultsData {
  id: string;
  context: 'professional' | 'dating' | 'social';
  trustworthiness: DimensionResult;
  competence: DimensionResult;
  approachability: DimensionResult;
  attractiveness: DimensionResult;
  overall: number;
  overall_percentile: number;
  summary: string;
  image_url?: string;
}

const DIMENSION_CONFIG = [
  {
    key: 'trustworthiness' as const,
    label: 'Trustworthiness',
    icon: '🤝',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.2)',
    research: 'Dominant axis in Todorov & Oosterhof (2008)',
  },
  {
    key: 'competence' as const,
    label: 'Competence',
    icon: '🧠',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.08)',
    borderColor: 'rgba(99,102,241,0.2)',
    research: 'Todorov et al. (2005) — predicts election outcomes',
  },
  {
    key: 'approachability' as const,
    label: 'Approachability',
    icon: '😊',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
    research: 'Sutherland et al. (2013) — driven by expression cues',
  },
  {
    key: 'attractiveness' as const,
    label: 'Attractiveness',
    icon: '✨',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(168,85,247,0.2)',
    research: 'Secondary dimension in Todorov face evaluation model',
  },
];

const CONTEXT_LABELS = {
  professional: '💼 Professional',
  dating:       '💙 Dating',
  social:       '🌐 Social',
};

function percentileLabel(p: number): string {
  if (p >= 90) return 'Top 10%';
  if (p >= 75) return 'Top 25%';
  if (p >= 50) return 'Above average';
  if (p >= 25) return 'Average';
  return 'Below average';
}

function ScoreBar({ score, color, delay }: { score: number; color: string; delay: number }) {
  return (
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ delay, duration: 1.2, ease: 'easeOut' }}
      />
    </div>
  );
}

function DimensionCard({
  config,
  data,
  index,
}: {
  config: typeof DIMENSION_CONFIG[0];
  data: DimensionResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const delay = 0.3 + index * 0.12;

  return (
    <motion.div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ backgroundColor: config.bgColor, borderColor: config.borderColor }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, type: 'spring', stiffness: 90 }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <h3 className="text-white font-semibold text-sm">{config.label}</h3>
            <p className="text-xs mt-0.5" style={{ color: config.color }}>{percentileLabel(data.percentile)}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <motion.span
            className="text-2xl font-bold text-white block"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.4, type: 'spring' }}
          >
            {data.score}
          </motion.span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>

      {/* Bar */}
      <ScoreBar score={data.score} color={config.color} delay={delay + 0.2} />

      {/* Analysis */}
      <p className="text-slate-300 text-sm leading-relaxed">{data.analysis}</p>

      {/* Tips (expandable) */}
      {data.tips.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs font-medium flex items-center gap-1.5 transition-colors"
            style={{ color: config.color }}
          >
            <span>{expanded ? '▾' : '▸'}</span>
            {expanded ? 'Hide tips' : `${data.tips.length} improvement tip${data.tips.length > 1 ? 's' : ''}`}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex flex-col gap-2.5"
              >
                {data.tips.map((tip, i) => {
                  const tipText = typeof tip === 'string' ? tip : tip.text;
                  const tipCategory = typeof tip === 'string' ? 'expression' : (tip.category || 'expression');
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: `${config.color}08`, border: `1px solid ${config.color}15` }}
                    >
                      <div className="shrink-0 mt-0.5">
                        <TipIcon category={tipCategory} color={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: config.color }}
                        >
                          {CATEGORY_LABELS[tipCategory] || tipCategory}
                        </span>
                        <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{tipText}</p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Research attribution */}
      <p className="text-xs text-slate-600 flex items-center gap-1">
        <Info className="w-3 h-3 shrink-0" />
        {config.research}
      </p>
    </motion.div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getResults(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    if (!cardRef.current || !data) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f0e2a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
      const file = new File([blob], 'first-impression-score.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'My First Impression Score', files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'first-impression-score.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/results/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading results…</p>
      </div>
    </main>
  );

  if (error || !data) return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass rounded-2xl p-8 text-center max-w-sm w-full">
        <p className="text-slate-400 mb-5">{error || 'Results not found.'}</p>
        <Link href="/upload" className="text-indigo-400 hover:text-indigo-300 text-sm">Try again →</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen px-6 py-16">
      {/* Nav */}
      <div className="fixed inset-x-0 top-0 z-50 glass border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={handleCopyLink} className="text-sm text-slate-400 hover:text-white transition-colors">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              {sharing ? '…' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pt-8 flex flex-col gap-8">
        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-block text-xs text-slate-500 mb-3">
            Context: {CONTEXT_LABELS[data.context]}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Your First Impression</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">{data.summary}</p>
        </motion.div>

        {/* Overall score + photo */}
        <motion.div
          ref={cardRef}
          className="glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          {/* Photo + score hero */}
          <div className="p-6 flex flex-col items-center gap-2">
            {/* Photo + score side by side */}
            {data.image_url ? (
              <div className="flex items-center gap-5 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${data.image_url}`}
                  alt="Your analyzed portrait"
                  className="w-20 h-20 rounded-2xl object-cover shrink-0"
                />
                <div className="flex flex-col items-start">
                  <div className="flex items-baseline gap-1">
                    <motion.span
                      className="text-5xl font-bold gradient-text"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      {data.overall}
                    </motion.span>
                    <span className="text-slate-500 text-lg">/100</span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Overall · {percentileLabel(data.overall_percentile)}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <motion.span
                    className="text-6xl font-bold gradient-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {data.overall}
                  </motion.span>
                  <span className="text-slate-500 text-lg">/100</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Overall · {percentileLabel(data.overall_percentile)}
                </p>
              </>
            )}
            {/* Mini bars for OG card */}
            <div className="w-full mt-4 grid grid-cols-4 gap-2">
              {DIMENSION_CONFIG.map((c) => (
                <div key={c.key} className="flex flex-col items-center gap-1">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-xs text-white font-semibold">{data[c.key].score}</span>
                  <span className="text-xs text-slate-500 text-center leading-tight">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Dimension cards */}
        <div className="flex flex-col gap-4">
          {DIMENSION_CONFIG.map((config, i) => (
            <DimensionCard
              key={config.key}
              config={config}
              data={data[config.key]}
              index={i}
            />
          ))}
        </div>

        {/* Ethics disclaimer */}
        <motion.div
          className="glass rounded-xl p-4 flex gap-3 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-slate-500 leading-relaxed">
            <strong className="text-slate-400">Important:</strong> These scores reflect how your photo <em>may be perceived</em> by others — not who you are as a person. 
            First-impression judgments are automatic and can embed social biases. 
            Based on research by Todorov et al. (2005–2008).
          </p>
        </motion.div>

        {/* Try again */}
        <div className="text-center">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try another photo
          </Link>
        </div>
      </div>
    </main>
  );
}
