# First Impression Web App

A full-stack AI-powered web app that analyzes facial first impressions using computer vision and AI scoring.

## Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: FastAPI, MediaPipe, OpenCV, Claude Vision
- **Storage**: Supabase (images + results)
- **Deploy**: Vercel (frontend) + Railway (backend)

## Project Structure

```
first-impression-app/
├── frontend/          # Next.js 14 app
├── backend/           # FastAPI server
├── ai_model/          # Model training scripts
└── build-manifest.md  # Build artifacts & decisions
```

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend (.env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
ANTHROPIC_API_KEY=your_anthropic_key
```
