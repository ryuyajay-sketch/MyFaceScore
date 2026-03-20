import type { Context } from './constants';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://myfacescore-api-production.up.railway.app';

export interface AnalyzeResponse {
  id: string;
  status: 'queued' | 'processing';
  message: string;
}

export interface PollResponse {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  progress?: number;
  step?: string;
}

export interface Tip {
  text: string;
  category: string;
}

export interface DimensionResult {
  score: number;
  percentile: number;
  analysis: string;
  tips: Tip[];
}

export interface ResultsResponse {
  id: string;
  context: Context;
  trustworthiness: DimensionResult;
  competence: DimensionResult;
  approachability: DimensionResult;
  attractiveness: DimensionResult;
  overall: number;
  overall_percentile: number;
  summary: string;
  image_url?: string;
  created_at?: string;
}

export async function analyzeImage(uri: string, context: Context, purpose?: string): Promise<AnalyzeResponse> {
  const formData = new FormData();

  const filename = uri.split('/').pop() || 'photo.jpg';
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  formData.append('file', {
    uri,
    name: filename,
    type: mimeType,
  } as any);
  formData.append('context', context);
  if (purpose) formData.append('purpose', purpose);

  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function pollResults(id: string): Promise<PollResponse> {
  const res = await fetch(`${BASE_URL}/results/${id}/status`);
  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json();
}

export interface ChatResponse {
  reply: string;
}

export async function chatWithAI(jobId: string, message: string): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat failed' }));
    throw new Error(err.detail || `Chat failed: ${res.status}`);
  }
  return res.json();
}

export async function getResults(id: string): Promise<ResultsResponse> {
  const res = await fetch(`${BASE_URL}/results/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Not found' }));
    throw new Error(err.detail || `Fetch failed: ${res.status}`);
  }
  return res.json();
}

export interface ComparePhotoResult {
  overall: number;
  trustworthiness: number;
  competence: number;
  approachability: number;
  attractiveness: number;
  strengths: string[];
  weaknesses: string[];
}

export interface CompareResponse {
  winner: 'A' | 'B';
  photo_a: ComparePhotoResult;
  photo_b: ComparePhotoResult;
  verdict: string;
  context: string;
}

export async function compareImages(uriA: string, uriB: string, context: Context): Promise<CompareResponse> {
  const formData = new FormData();

  for (const [key, uri] of [['file_a', uriA], ['file_b', uriB]] as const) {
    const filename = uri.split('/').pop() || 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    formData.append(key, { uri, name: filename, type: mimeType } as any);
  }
  formData.append('context', context);

  const res = await fetch(`${BASE_URL}/compare`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Comparison failed' }));
    throw new Error(err.detail || `Compare failed: ${res.status}`);
  }

  return res.json();
}
