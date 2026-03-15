# Build Manifest — First Impression Web App

**Task ID:** 7650abd9-ae48-45c4-ab9c-07c947c04f48  
**Research Brief:** research-brief.md (Researcher Agent, 2026-03-09)  
**Builder:** Builder Agent  
**Last Updated:** 2026-03-09  
**Status:** MVP Complete

---

## What Was Built

Full-stack MVP matching the research brief spec:
- Next.js 14 (App Router, TypeScript, Tailwind) → Vercel
- FastAPI (Python, async) → Railway
- Supabase (Postgres + Storage)
- Claude Vision scoring (Todorov-aligned, 4 dimensions)
- MediaPipe face detection + alignment + CLAHE preprocessing

---

## File Tree

```
first-impression-app/
├── README.md
├── build-manifest.md
├── research-brief.md             ← from Researcher Agent
│
├── frontend/
│   ├── package.json              Next.js 14, Framer Motion, react-dropzone, html2canvas
│   ├── next.config.js
│   ├── tailwind.config.ts        Dark navy theme, glass morphism, custom animations
│   ├── tsconfig.json
│   ├── postcss.config.js
│   ├── vercel.json
│   ├── app/
│   │   ├── globals.css           Glass utilities, gradient text, scan animation
│   │   ├── layout.tsx            Root layout + metadata
│   │   ├── page.tsx              Landing — hero, demo score bars, features, CTA
│   │   ├── upload/page.tsx       Context picker (Dating/Professional/Social) + dropzone
│   │   ├── processing/page.tsx   Face scan animation + step progress + polling
│   │   └── results/[id]/page.tsx 4 score cards w/ bars, tips, percentile, OG share card
│   └── lib/
│       └── api.ts                Typed API client (analyzeImage, pollResults, getResults)
│
├── backend/
│   ├── main.py                   FastAPI app + CORS + GZip
│   ├── config.py                 Pydantic Settings
│   ├── requirements.txt
│   ├── railway.toml
│   ├── supabase_schema.sql       v2: JSONB dimensions, context, RLS, cleanup
│   ├── .env.example
│   ├── routers/
│   │   ├── analyze.py            POST /analyze (file + context form fields)
│   │   └── results.py            GET /results/{id} + /status
│   ├── models/
│   │   └── scoring.py            Claude Vision + Todorov rubric + context weights + tips
│   └── utils/
│       ├── image_processing.py   MediaPipe detect → FaceMesh align → CLAHE → crop → resize
│       └── supabase_client.py    Storage upload + DB CRUD
│
└── ai_model/
    ├── synthetic_labeling.py     Claude Vision batch labeler for CFD/KDEF → JSONL
    ├── fine_tune.py              EfficientNet-B3 → HuberLoss → ONNX export
    └── requirements.txt
```

---

## Architecture

### Image Pipeline
```
Upload (JPEG/PNG ≤10MB) + context selection
  → MediaPipe FaceDetection (reject: no face / multiple faces)
  → FaceMesh 478-landmark eye alignment (rotate to level eyes)
  → CLAHE (clip=2.0, tile=8×8) on L channel in LAB space only
  → Crop with 40% padding + resize to 512px
  → Claude Vision (Todorov-aligned rubric, context-specific weights)
  → Supabase DB (JSONB dimensions) + Storage (pre-processed image)
  → DELETE original bytes immediately
```

### Scoring Dimensions (Todorov model)
| Dimension | Research basis | Context weights |
|-----------|---------------|-----------------|
| Trustworthiness | Dominant axis, Oosterhof & Todorov (2008) | Prof: 35% · Dating: 25% · Social: 30% |
| Competence | Todorov et al. (2005) — predicts elections | Prof: 30% · Dating: 15% · Social: 20% |
| Approachability | Sutherland et al. (2013) — expression cues | Prof: 25% · Dating: 30% · Social: 35% |
| Attractiveness | Secondary Todorov dimension | Prof: 10% · Dating: 30% · Social: 15% |

Per dimension output: `score` (1–100), `percentile` (1–99), `analysis` (1–2 sentences), `tips` (2 actionable strings)

### Scoring Model (v1 — shipped)
- Claude Opus 4.5 with structured JSON prompt + Todorov rubric
- Context-specific dimension weights applied server-side
- Tips: Specific + actionable (e.g. Duchenne smile instruction, not "smile more")

### Scoring Model (v2 — roadmap)
- EfficientNet-B3 fine-tuned on Claude-labeled CFD/KDEF images
- ONNX export for ~100× cost reduction at scale
- Switch at ~200 MAU (per research brief recommendation)

### Context Selection Flow
```
Landing → Context picker (Professional/Dating/Social) → Upload → Processing → Results
```
Context stored with job, affects scoring weights and tip language.

### Share Card
- `html2canvas` at 2× DPR captures results card as PNG
- `navigator.share` with file for mobile; download fallback for desktop

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 4 dimensions (not 3) | Research brief specifies Todorov's 4-axis model (Trust, Competence, Approachability, Attract) |
| Context selection step before upload | Research brief: context affects which scores matter; professional vs dating weight differ significantly |
| Per-dimension coaching tips | Sutherland et al. (2013) validates that approachability is partially controllable via expression; tips add clear value over raw scores |
| Percentile + score | Percentile is more intuitive for users than raw 1–100; both shown |
| CLAHE on L channel only | Enhances local contrast without colour distortion |
| Photo deleted post-analysis | GDPR/BIPA risk mitigation; research brief explicitly calls this out |
| Ethics disclaimer on results page | Research brief: distinguish perception from reality; protect against pseudoscience framing |

---

## Deployment

### Supabase
```bash
# 1. Create project at supabase.com
# 2. Run backend/supabase_schema.sql in SQL Editor
# 3. Create Storage bucket: face-uploads (public, 10MB)
# 4. Copy URL + keys
```

### Backend → Railway
```bash
# root: /backend
# env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
#      ALLOWED_ORIGINS=https://your-app.vercel.app
# railway.toml handles build + deploy
```

### Frontend → Vercel
```bash
# root: /frontend
# env: NEXT_PUBLIC_API_URL=https://your-api.railway.app
#      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Known Gaps (Priority Order)

| Item | Priority | Notes |
|------|----------|-------|
| Rate limiting on POST /analyze | High | Add slowapi — critical before public launch |
| Bias audit across demographics | High | Research brief §8a — must run before launch |
| 24h auto-delete cron | High | Supabase pg_cron or Railway cron to call cleanup_old_results() |
| Error boundary in Results page | Medium | Next.js error.tsx file |
| v2 ONNX inference | Medium | At ~200 MAU per research brief |
| Unit tests (pytest) | Medium | image_processing pipeline + scoring response parsing |
| Freemium / credits | Low | Research brief §9 — after demand validation |
| A/B photo comparison | Low | v1.1 feature per research brief |

---

## Research Brief Alignment

| Brief requirement | Status |
|-------------------|--------|
| 4 Todorov dimensions (Trust, Competence, Approachability, Attract) | ✅ |
| Context selection: Dating / Professional / Social | ✅ |
| Coaching tips per dimension | ✅ |
| Percentile display | ✅ |
| MediaPipe face detection (reject multi-face) | ✅ |
| Privacy-first (photo deleted) | ✅ |
| Ethics disclaimer | ✅ |
| Science attribution in UI | ✅ |
| Supabase Auth + history | 🔲 v1.1 |
| A/B comparison | 🔲 v1.1 |

---

*Built by Builder Agent against research-brief.md spec.*
