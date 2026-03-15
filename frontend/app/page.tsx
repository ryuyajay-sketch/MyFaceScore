'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, Zap, Lock, BookOpen, Star } from 'lucide-react';

const DIMENSIONS = [
  { label: 'Trustworthiness', value: 84, color: '#06b6d4', icon: '🤝' },
  { label: 'Competence',      value: 77, color: '#6366f1', icon: '🧠' },
  { label: 'Approachability', value: 91, color: '#22c55e', icon: '😊' },
  { label: 'Attractiveness',  value: 73, color: '#a855f7', icon: '✨' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant AI Analysis',
    desc: 'Results in under 5 seconds using a vision model trained on Todorov-aligned perception research.',
  },
  {
    icon: BookOpen,
    title: 'Science-Backed Dimensions',
    desc: 'Scores on Trustworthiness, Competence, Approachability & Attractiveness — the four axes from Oosterhof & Todorov (2008).',
  },
  {
    icon: Lock,
    title: 'Photo Deleted Instantly',
    desc: 'Your image is processed server-side and deleted immediately. Nothing is stored without consent.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.55, ease: 'easeOut' } }),
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 glass border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold text-white tracking-tight">First Impression <span className="text-indigo-400">AI</span></span>
          <Link
            href="/upload"
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Try free →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 flex flex-col items-center text-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-700/10 rounded-full blur-3xl" />
        </div>

        <motion.p
          className="text-sm text-indigo-300 mb-5 flex items-center gap-1.5"
          variants={fadeUp} initial="hidden" animate="show" custom={0}
        >
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          Based on Todorov lab research · Willis & Todorov 2006 · Oosterhof & Todorov 2008
        </motion.p>

        <motion.h1
          className="text-5xl md:text-6xl font-bold text-white max-w-3xl leading-tight"
          variants={fadeUp} initial="hidden" animate="show" custom={1}
        >
          How does your photo{' '}
          <span className="gradient-text">make people feel?</span>
        </motion.h1>

        <motion.p
          className="mt-5 text-lg text-slate-400 max-w-xl leading-relaxed"
          variants={fadeUp} initial="hidden" animate="show" custom={2}
        >
          Upload a portrait. Get instant AI scores on the four dimensions that shape first impressions in{' '}
          <strong className="text-slate-200">under 100ms</strong> — plus actionable tips to improve them.
        </motion.p>

        <motion.div
          className="mt-9 flex flex-col sm:flex-row gap-3"
          variants={fadeUp} initial="hidden" animate="show" custom={3}
        >
          <Link
            href="/upload"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-base transition-all shadow-lg shadow-indigo-900/40 hover:scale-105"
          >
            Analyze My Photo
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/compare"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-xl glass border border-white/10 hover:border-indigo-500/40 text-slate-300 hover:text-white font-semibold text-base transition-all hover:scale-105"
          >
            Compare Two Photos
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Demo score bars */}
        <motion.div
          className="mt-16 w-full max-w-sm glass rounded-2xl p-6 text-left"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider">Sample result — Professional context</p>
          <div className="flex flex-col gap-4">
            {DIMENSIONS.map((d, i) => (
              <DemoBar key={d.label} dimension={d} delay={0.7 + i * 0.12} />
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-4">Scores reflect how your photo may be perceived, not who you are.</p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass rounded-2xl p-5 flex flex-col gap-3"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-900/50 flex items-center justify-center">
                <f.icon className="w-4.5 h-4.5 text-indigo-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 flex justify-center">
        <motion.div
          className="glass rounded-3xl p-10 max-w-lg w-full text-center"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-3">See your scores in seconds</h2>
          <p className="text-slate-400 mb-7 text-sm">Free · No account needed · Photo deleted immediately after scoring</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold transition-all hover:from-indigo-500 hover:to-purple-500"
          >
            Get My Score <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-slate-600">
        First Impression AI · Scores reflect social perception, not character · Based on published social psychology research
      </footer>
    </main>
  );
}

function DemoBar({ dimension: d, delay }: { dimension: typeof DIMENSIONS[0]; delay: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center">{d.icon}</span>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-300">{d.label}</span>
          <span className="text-xs font-semibold text-white">{d.value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: d.color }}
            initial={{ width: 0 }}
            animate={{ width: `${d.value}%` }}
            transition={{ delay, duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}
