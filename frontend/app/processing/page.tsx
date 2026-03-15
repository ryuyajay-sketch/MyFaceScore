'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { pollResults } from '@/lib/api';

const STEP_LABELS: Record<string, string> = {
  queued: 'Waiting in queue…',
  detecting: 'Detecting face landmarks…',
  enhancing: 'Enhancing image quality…',
  uploading: 'Preparing image…',
  scoring: 'AI is scoring your photo…',
  finalizing: 'Generating your results…',
};

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [step, setStep] = useState('queued');
  const [failed, setFailed] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const animRef = useRef<number | null>(null);

  // Smooth progress animation — interpolate displayProgress toward target
  useEffect(() => {
    let current = displayProgress;
    const target = progress;

    const tick = () => {
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        setDisplayProgress(target);
        return;
      }
      // Ease toward target: faster when far away, slower when close
      current += diff * 0.12;
      setDisplayProgress(Math.round(current));
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [progress]); // intentionally only depend on target progress

  // Poll for results
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await pollResults(id);
        if (cancelled) return;

        if (result.progress != null) {
          setProgress(result.progress);
        }
        if (result.step) {
          setStep(result.step);
        }

        if (result.status === 'ready') {
          setProgress(100);
          setStep('finalizing');
          setTimeout(() => router.push(`/results/${id}`), 800);
          return;
        }
        if (result.status === 'failed') {
          setFailed(true);
          return;
        }
        pollRef.current = setTimeout(poll, 1000);
      } catch {
        if (!cancelled) {
          pollRef.current = setTimeout(poll, 2000);
        }
      }
    };

    pollRef.current = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [id, router]);

  if (!id) {
    router.replace('/upload');
    return null;
  }

  const stepLabel = STEP_LABELS[step] ?? STEP_LABELS['queued'];

  if (failed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/40 border border-red-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Analysis Failed</h2>
            <p className="text-slate-400 text-sm">Something went wrong. Please try again with a clear, front-facing portrait.</p>
          </div>
          <button
            onClick={() => router.push('/upload')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-10">
        {/* Face scan animation */}
        <div className="relative w-40 h-40">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-indigo-500/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-4 rounded-full border border-purple-500/40"
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-8 rounded-full bg-indigo-900/40 border border-indigo-500/20"
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-14 h-14 text-indigo-400" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="26" r="14" stroke="currentColor" strokeWidth="2" />
              <path d="M10 54c0-12.15 9.85-22 22-22s22 9.85 22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="27" cy="25" r="2" fill="currentColor" opacity="0.8" />
              <circle cx="37" cy="25" r="2" fill="currentColor" opacity="0.8" />
              <path d="M27 31c1.5 2 8.5 2 10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>

        {/* Progress section */}
        <div className="w-full flex flex-col items-center gap-5">
          {/* Percentage */}
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-white tabular-nums">{displayProgress}</span>
            <span className="text-lg text-slate-400">%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
              style={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Step label */}
          <p className="text-slate-400 text-sm h-5">{stepLabel}</p>
        </div>

        {/* Time estimate */}
        <p className="text-slate-600 text-xs text-center">Usually takes 5–10 seconds</p>
      </div>
    </main>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense>
      <ProcessingContent />
    </Suspense>
  );
}
