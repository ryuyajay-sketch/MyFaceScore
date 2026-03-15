'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { Upload, AlertCircle, ArrowLeft, ChevronRight, Crop, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import Link from 'next/link';
import Cropper, { Area } from 'react-easy-crop';
import { analyzeImage } from '@/lib/api';

type Context = 'professional' | 'dating' | 'social';
type UploadState = 'context' | 'idle' | 'cropping' | 'preview' | 'uploading';

const CONTEXTS: { id: Context; label: string; emoji: string; desc: string }[] = [
  { id: 'professional', label: 'Professional', emoji: '💼', desc: 'LinkedIn, résumé, job applications' },
  { id: 'dating',       label: 'Dating',       emoji: '💙', desc: 'Dating apps, social profiles' },
  { id: 'social',       label: 'Social',       emoji: '🌐', desc: 'Instagram, general social media' },
];

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

  // To handle rotation, we first draw the rotated full image onto an
  // off-screen canvas, then extract the cropped region from it.
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  // Bounding box of the rotated image
  const rotW = image.naturalWidth * cos + image.naturalHeight * sin;
  const rotH = image.naturalWidth * sin + image.naturalHeight * cos;

  // Draw rotated image
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext('2d')!;
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(radians);
  rotCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  // Extract cropped region
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    rotCanvas,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, crop.width, crop.height,
  );

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

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('context');
  const [context, setContext] = useState<Context | null>(null);
  const [rawPreview, setRawPreview] = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [originalFileName, setOriginalFileName] = useState('photo.jpg');
  const [error, setError] = useState<string | null>(null);

  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const handleContextSelect = (c: Context) => {
    setContext(c);
    setState('idle');
  };

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      setError('Please upload a JPEG or PNG under 10MB.');
      return;
    }
    const f = accepted[0];
    setOriginalFileName(f.name);
    setRawPreview(URL.createObjectURL(f));
    setState('cropping');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/heic': ['.heic'], 'image/heif': ['.heif'], 'image/webp': ['.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: state !== 'idle',
  });

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!rawPreview || !croppedArea) return;
    try {
      const cropped = await getCroppedFile(rawPreview, croppedArea, rotation, originalFileName);
      setFile(cropped);
      setCroppedPreview(URL.createObjectURL(cropped));
      setState('preview');
    } catch {
      setError('Failed to crop image. Please try again.');
    }
  };

  const handleSkipCrop = () => {
    if (!rawPreview) return;
    // Use original file without cropping
    fetch(rawPreview)
      .then((r) => r.blob())
      .then((blob) => {
        const f = new File([blob], originalFileName, { type: blob.type });
        setFile(f);
        setCroppedPreview(rawPreview);
        setState('preview');
      })
      .catch(() => setError('Failed to process image.'));
  };

  const handleAnalyze = async () => {
    if (!file || !context) return;
    setState('uploading');
    setError(null);
    try {
      const { id } = await analyzeImage(file, context);
      router.push(`/processing?id=${id}`);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
      setState('preview');
    }
  };

  const handleReset = () => {
    if (rawPreview) URL.revokeObjectURL(rawPreview);
    if (croppedPreview && croppedPreview !== rawPreview) URL.revokeObjectURL(croppedPreview);
    setRawPreview(null);
    setCroppedPreview(null);
    setFile(null);
    setState('idle');
    setError(null);
  };

  const handleBackToCrop = () => {
    if (croppedPreview && croppedPreview !== rawPreview) URL.revokeObjectURL(croppedPreview);
    setCroppedPreview(null);
    setFile(null);
    setState('cropping');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="fixed inset-x-0 top-0 z-50 glass border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md pt-8">
        <AnimatePresence mode="wait">

          {/* Step 1 — context selection */}
          {state === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <h1 className="text-2xl font-bold text-white text-center mb-2">What's this photo for?</h1>
              <p className="text-slate-400 text-center text-sm mb-8">Scoring is optimised per context.</p>
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

          {/* Step 2 — upload */}
          {state === 'idle' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setState('context')} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
                  ← Change context
                </button>
                <span className="text-slate-600">·</span>
                <span className="text-sm text-indigo-300 capitalize">{context}</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Upload your photo</h1>
              <p className="text-slate-400 text-sm mb-8">Clear, front-facing portrait · good lighting · one person</p>

              <div
                {...getRootProps()}
                className={`glass rounded-2xl p-12 flex flex-col items-center gap-5 cursor-pointer transition-all duration-200
                  ${isDragActive ? 'border-indigo-500 bg-indigo-900/20 scale-[1.02]' : 'hover:border-indigo-500/40 hover:bg-indigo-900/5'}`}
              >
                <input {...getInputProps()} />
                <motion.div
                  className="w-16 h-16 rounded-xl bg-indigo-900/50 flex items-center justify-center"
                  animate={isDragActive ? { scale: 1.15 } : { scale: 1 }}
                >
                  <Upload className="w-7 h-7 text-indigo-400" />
                </motion.div>
                <div className="text-center">
                  <p className="text-white font-medium">{isDragActive ? 'Drop it here' : 'Drag & drop or click'}</p>
                  <p className="text-slate-500 text-sm mt-1">JPEG or PNG · max 10MB</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3 — crop */}
          {state === 'cropping' && rawPreview && (
            <motion.div
              key="crop"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crop className="w-5 h-5 text-indigo-400" /> Crop your photo
                </h2>
                <button
                  onClick={handleSkipCrop}
                  className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Skip →
                </button>
              </div>

              {/* Crop area */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="relative w-full aspect-square bg-black/50">
                  <Cropper
                    image={rawPreview}
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

                {/* Controls */}
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

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setRotation((r) => (r - 90) % 360)}
                      className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all"
                    >
                      <RotateCcw className="w-4 h-4" /> Rotate
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all"
                    >
                      Change Photo
                    </button>
                    <button
                      onClick={handleCropConfirm}
                      className="flex-[1.5] py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium transition-all hover:from-indigo-500 hover:to-purple-500"
                    >
                      Crop & Continue →
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4 — preview + confirm */}
          {(state === 'preview' || state === 'uploading') && croppedPreview && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={croppedPreview} alt="Your uploaded portrait photo preview" className="w-full h-full object-cover" />
                {state === 'uploading' && (
                  <div className="absolute inset-0 bg-navy-950/70 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                    <p className="text-white text-sm font-medium">Uploading…</p>
                  </div>
                )}
              </div>
              <div className="p-5 flex gap-3">
                <button
                  onClick={handleBackToCrop}
                  disabled={state === 'uploading'}
                  className="flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all disabled:opacity-40"
                >
                  Re-crop
                </button>
                <button
                  onClick={handleReset}
                  disabled={state === 'uploading'}
                  className="flex-1 py-2.5 rounded-xl glass text-slate-300 hover:text-white text-sm font-medium transition-all disabled:opacity-40"
                >
                  Change
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={state === 'uploading'}
                  className="flex-[1.5] py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40"
                >
                  Analyze →
                </button>
              </div>
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

        {/* Privacy note */}
        <p className="mt-6 text-center text-xs text-slate-600">
          🔒 Photo is deleted immediately after analysis. We never store your image.
        </p>
      </div>
    </main>
  );
}
