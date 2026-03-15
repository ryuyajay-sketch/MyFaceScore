'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, Upload, Trophy, ChevronRight, AlertCircle, Crop, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import Cropper, { Area } from 'react-easy-crop';
import { comparePhotos, type CompareResponse, type Context } from '@/lib/api';

type Step = 'context' | 'upload' | 'comparing' | 'results';

const CONTEXTS: { id: Context; label: string; emoji: string; desc: string }[] = [
  { id: 'professional', label: 'Professional', emoji: '💼', desc: 'LinkedIn, résumé, job applications' },
  { id: 'dating',       label: 'Dating',       emoji: '💙', desc: 'Dating apps, social profiles' },
  { id: 'social',       label: 'Social',       emoji: '🌐', desc: 'Instagram, general social media' },
];

const DIMENSIONS = [
  { key: 'trustworthiness', label: 'Trust', icon: '🤝', color: '#06b6d4' },
  { key: 'competence',      label: 'Competence', icon: '🧠', color: '#6366f1' },
  { key: 'approachability', label: 'Approach', icon: '😊', color: '#22c55e' },
  { key: 'attractiveness',  label: 'Attract', icon: '✨', color: '#a855f7' },
] as const;

/** Convert a cropped area into a File via canvas, accounting for rotation. */
async function getCroppedFile(
  imageSrc: string,
  crop: Area,
  rotation: number,
  fileName: string,
): Promise<File> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = image.naturalWidth * cos + image.naturalHeight * sin;
  const rotH = image.naturalWidth * sin + image.naturalHeight * cos;

  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext('2d')!;
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(radians);
  rotCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(rotCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  });
}

/** Crop modal overlay */
function CropModal({
  imageSrc,
  label,
  onConfirm,
  onSkip,
}: {
  imageSrc: string;
  label: string;
  onConfirm: (file: File, preview: string) => void;
  onSkip: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    const file = await getCroppedFile(imageSrc, croppedArea, rotation, `${label}.jpg`);
    const preview = URL.createObjectURL(file);
    onConfirm(file, preview);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass rounded-2xl overflow-hidden w-full max-w-md"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Crop className="w-4 h-4 text-indigo-400" /> Crop {label}
          </h3>
          <button onClick={onSkip} className="text-slate-400 hover:text-white text-sm transition-colors">
            Skip →
          </button>
        </div>

        <div className="relative w-full aspect-square bg-black/50">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape="rect"
            showGrid={true}
            style={{
              containerStyle: { borderRadius: '0' },
              cropAreaStyle: { border: '2px solid rgba(99, 102, 241, 0.7)' },
            }}
          />
        </div>

        <div className="p-4 flex flex-col gap-3">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-slate-700 accent-indigo-500 cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-slate-500 shrink-0" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setRotation((r) => (r - 90) % 360)}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Rotate
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium transition-all hover:from-indigo-500 hover:to-purple-500"
            >
              Crop & Use →
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PhotoSlot({
  label,
  preview,
  onDrop,
  onCropClick,
  disabled,
}: {
  label: string;
  preview: string | null;
  onDrop: (files: File[]) => void;
  onCropClick: () => void;
  disabled: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => { if (accepted.length) onDrop(accepted); },
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/heic': ['.heic'], 'image/heif': ['.heif'], 'image/webp': ['.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled,
  });

  return (
    <div className="flex-1 flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={`glass rounded-2xl overflow-hidden cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-indigo-500 bg-indigo-900/20 scale-[1.02]' : 'hover:border-indigo-500/40'}
          ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={`${label} preview`} className="w-full aspect-square object-cover" />
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-bold">
              {label}
            </div>
          </div>
        ) : (
          <div className="aspect-square flex flex-col items-center justify-center gap-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-900/50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-slate-500 text-xs mt-1">Drop or click</p>
            </div>
          </div>
        )}
      </div>
      {preview && (
        <button
          onClick={onCropClick}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl glass text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <Crop className="w-3 h-3" /> Re-crop
        </button>
      )}
    </div>
  );
}

function ScoreBar({ value, color, delay }: { value: number; color: string; delay: number }) {
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ delay, duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

export default function ComparePage() {
  const [step, setStep] = useState<Step>('context');
  const [context, setContext] = useState<Context | null>(null);
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Crop modal state
  const [cropTarget, setCropTarget] = useState<'A' | 'B' | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  const handleContextSelect = (c: Context) => {
    setContext(c);
    setStep('upload');
  };

  const openCropModal = (target: 'A' | 'B', file: File) => {
    const src = URL.createObjectURL(file);
    setRawImageSrc(src);
    setCropTarget(target);
  };

  const handleDropA = useCallback((files: File[]) => {
    setError(null);
    openCropModal('A', files[0]);
  }, []);

  const handleDropB = useCallback((files: File[]) => {
    setError(null);
    openCropModal('B', files[0]);
  }, []);

  const handleCropConfirm = (file: File, preview: string) => {
    if (cropTarget === 'A') {
      if (previewA) URL.revokeObjectURL(previewA);
      setFileA(file);
      setPreviewA(preview);
    } else {
      if (previewB) URL.revokeObjectURL(previewB);
      setFileB(file);
      setPreviewB(preview);
    }
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
    setCropTarget(null);
  };

  const handleCropSkip = () => {
    // Use original image without cropping
    if (rawImageSrc && cropTarget) {
      fetch(rawImageSrc)
        .then((r) => r.blob())
        .then((blob) => {
          const f = new File([blob], `photo-${cropTarget}.jpg`, { type: blob.type });
          if (cropTarget === 'A') {
            if (previewA) URL.revokeObjectURL(previewA);
            setFileA(f);
            setPreviewA(rawImageSrc);
          } else {
            if (previewB) URL.revokeObjectURL(previewB);
            setFileB(f);
            setPreviewB(rawImageSrc);
          }
          setRawImageSrc(null);
          setCropTarget(null);
        });
    }
  };

  const handleReCropA = () => {
    if (fileA) openCropModal('A', fileA);
  };

  const handleReCropB = () => {
    if (fileB) openCropModal('B', fileB);
  };

  const handleCompare = async () => {
    if (!fileA || !fileB || !context) return;
    setStep('comparing');
    setError(null);
    try {
      const res = await comparePhotos(fileA, fileB, context);
      setResult(res);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'Comparison failed. Please try again.');
      setStep('upload');
    }
  };

  const handleReset = () => {
    if (previewA) URL.revokeObjectURL(previewA);
    if (previewB) URL.revokeObjectURL(previewB);
    setFileA(null);
    setFileB(null);
    setPreviewA(null);
    setPreviewB(null);
    setResult(null);
    setStep('upload');
    setError(null);
  };

  const canCompare = fileA && fileB;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="fixed inset-x-0 top-0 z-50 glass border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </div>

      <div className="w-full max-w-lg pt-8">
        <AnimatePresence mode="wait">

          {/* Step 1 — context */}
          {step === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <h1 className="text-2xl font-bold text-white text-center mb-2">Compare Two Photos</h1>
              <p className="text-slate-400 text-center text-sm mb-8">Pick a context, then upload two photos to see which one wins.</p>
              <div className="flex flex-col gap-3">
                {CONTEXTS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleContextSelect(c.id)}
                    className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-500/50 transition-all text-left group"
                  >
                    <span className="text-3xl">{c.emoji}</span>
                    <div className="flex-1">
                      <div className="text-white font-semibold">{c.label}</div>
                      <div className="text-slate-400 text-sm">{c.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2 — upload two photos */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setStep('context')} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
                  ← Change context
                </button>
                <span className="text-slate-600">·</span>
                <span className="text-sm text-indigo-300 capitalize">{context}</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Upload two photos</h1>
              <p className="text-slate-400 text-sm mb-6">We'll tell you which one makes a stronger first impression.</p>

              <div className="flex gap-3">
                <PhotoSlot label="Photo A" preview={previewA} onDrop={handleDropA} onCropClick={handleReCropA} disabled={false} />
                <PhotoSlot label="Photo B" preview={previewB} onDrop={handleDropB} onCropClick={handleReCropB} disabled={false} />
              </div>

              <div className="mt-5 flex gap-3">
                {(fileA || fileB) && (
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={handleCompare}
                  disabled={!canCompare}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Compare →
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3 — comparing */}
          {step === 'comparing' && (
            <motion.div
              key="comparing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              <div className="flex items-center gap-4">
                {previewA && (
                  <div className="w-28 h-28 rounded-2xl overflow-hidden glass">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewA} alt="Photo A" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl font-bold text-slate-600">VS</span>
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                </div>
                {previewB && (
                  <div className="w-28 h-28 rounded-2xl overflow-hidden glass">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewB} alt="Photo B" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <p className="text-slate-400 text-sm">Analyzing both photos...</p>
            </motion.div>
          )}

          {/* Step 4 — results */}
          {step === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6"
            >
              {/* Winner banner */}
              <motion.div
                className="glass rounded-2xl p-5 text-center"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 100 }}
              >
                <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-white">
                  Photo {result.winner} wins!
                </h2>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                  {result.verdict}
                </p>
              </motion.div>

              {/* Side by side scores */}
              <div className="flex gap-3">
                {/* Photo A */}
                <div className={`flex-1 rounded-2xl overflow-hidden ${result.winner === 'A' ? 'ring-2 ring-yellow-400/50' : ''}`}>
                  <div className="glass rounded-2xl overflow-hidden">
                    {previewA && (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewA} alt="Photo A" className="w-full aspect-square object-cover" />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-bold flex items-center gap-1">
                          A {result.winner === 'A' && <Trophy className="w-3 h-3 text-yellow-400" />}
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-3xl font-bold gradient-text">{result.photo_a.overall}</span>
                        <span className="text-slate-500 text-sm">/100</span>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {DIMENSIONS.map((d, i) => (
                          <div key={d.key}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-slate-400">{d.icon} {d.label}</span>
                              <span className="text-white font-semibold">{(result.photo_a as any)[d.key]}</span>
                            </div>
                            <ScoreBar value={(result.photo_a as any)[d.key]} color={d.color} delay={0.2 + i * 0.1} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] text-green-400 uppercase tracking-wider font-semibold mb-1">Strengths</p>
                        {result.photo_a.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-slate-400 leading-relaxed">+ {s}</p>
                        ))}
                      </div>
                      <div className="mt-2">
                        <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1">To improve</p>
                        {result.photo_a.weaknesses.map((w, i) => (
                          <p key={i} className="text-xs text-slate-500 leading-relaxed">- {w}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo B */}
                <div className={`flex-1 rounded-2xl overflow-hidden ${result.winner === 'B' ? 'ring-2 ring-yellow-400/50' : ''}`}>
                  <div className="glass rounded-2xl overflow-hidden">
                    {previewB && (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewB} alt="Photo B" className="w-full aspect-square object-cover" />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-bold flex items-center gap-1">
                          B {result.winner === 'B' && <Trophy className="w-3 h-3 text-yellow-400" />}
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-3xl font-bold gradient-text">{result.photo_b.overall}</span>
                        <span className="text-slate-500 text-sm">/100</span>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {DIMENSIONS.map((d, i) => (
                          <div key={d.key}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-slate-400">{d.icon} {d.label}</span>
                              <span className="text-white font-semibold">{(result.photo_b as any)[d.key]}</span>
                            </div>
                            <ScoreBar value={(result.photo_b as any)[d.key]} color={d.color} delay={0.2 + i * 0.1} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] text-green-400 uppercase tracking-wider font-semibold mb-1">Strengths</p>
                        {result.photo_b.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-slate-400 leading-relaxed">+ {s}</p>
                        ))}
                      </div>
                      <div className="mt-2">
                        <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1">To improve</p>
                        {result.photo_b.weaknesses.map((w, i) => (
                          <p key={i} className="text-xs text-slate-500 leading-relaxed">- {w}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all"
                >
                  Compare Again
                </button>
                <Link
                  href="/upload"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium text-center transition-all hover:from-indigo-500 hover:to-purple-500"
                >
                  Full Analysis →
                </Link>
              </div>

              <p className="text-xs text-slate-600 text-center">
                Scores reflect perceived first impression, not character. Based on Todorov et al. research.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="mt-4 flex items-center gap-3 p-3.5 rounded-xl bg-red-900/20 border border-red-800/40 text-red-300 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Crop modal */}
      <AnimatePresence>
        {cropTarget && rawImageSrc && (
          <CropModal
            imageSrc={rawImageSrc}
            label={`Photo ${cropTarget}`}
            onConfirm={handleCropConfirm}
            onSkip={handleCropSkip}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
