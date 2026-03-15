-- First Impression App — Supabase Schema (v2: Todorov 4-dimension model)
-- Run in the Supabase SQL Editor

-- ─────────────────────────────────────────────
-- Analysis Results Table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,

  -- Job state
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'failed')),

  -- Scoring context
  context TEXT DEFAULT 'professional'
    CHECK (context IN ('professional', 'dating', 'social')),

  -- Todorov-aligned dimensions (stored as JSONB for tips/analysis)
  -- Shape: { score, percentile, analysis, tips[] }
  trustworthiness JSONB,
  competence      JSONB,
  approachability JSONB,
  attractiveness  JSONB,

  -- Aggregates
  overall             INTEGER CHECK (overall BETWEEN 1 AND 100),
  overall_percentile  INTEGER CHECK (overall_percentile BETWEEN 1 AND 99),
  summary             TEXT,

  -- Metadata
  image_url                    TEXT,
  face_detection_confidence    FLOAT,
  error                        TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analysis_results_updated_at ON analysis_results;
CREATE TRIGGER analysis_results_updated_at
  BEFORE UPDATE ON analysis_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_results_status ON analysis_results (status);
CREATE INDEX IF NOT EXISTS idx_results_context ON analysis_results (context);
CREATE INDEX IF NOT EXISTS idx_results_created ON analysis_results (created_at DESC);

-- ─────────────────────────────────────────────
-- Auto-cleanup after 24h (call via cron or webhook)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_results() RETURNS void AS $$
BEGIN
  DELETE FROM analysis_results
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Public: read ready results (for share links)
CREATE POLICY "Public read ready results"
  ON analysis_results FOR SELECT
  USING (status = 'ready');

-- Service role: full access (backend uses service key)
CREATE POLICY "Service role full access"
  ON analysis_results FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- Storage Bucket (set up via Supabase UI)
-- ─────────────────────────────────────────────
-- Name: face-uploads
-- Public: true
-- File size limit: 10 MB
-- Allowed MIME types: image/jpeg, image/png
-- TTL: none (handled by cleanup_old_results)
