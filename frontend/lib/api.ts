const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type Context = 'professional' | 'dating' | 'social';

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

export async function analyzeImage(file: File, context: Context): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context', context);

  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
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

export async function getResults(id: string): Promise<ResultsResponse> {
  const res = await fetch(`${BASE_URL}/results/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Not found' }));
    throw new Error(err.detail || `Fetch failed: ${res.status}`);
  }
  return res.json();
}

export interface PhotoScore {
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
  photo_a: PhotoScore;
  photo_b: PhotoScore;
  verdict: string;
  context: Context;
}

export async function comparePhotos(fileA: File, fileB: File, context: Context): Promise<CompareResponse> {
  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);
  formData.append('context', context);

  const res = await fetch(`${BASE_URL}/compare`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Comparison failed' }));
    throw new Error(err.detail || `Compare failed: ${res.status}`);
  }

  return res.json();
}
