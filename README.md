# PronounceRight — AI Pronunciation Coach

Built for the Livo AI Software Engineer assessment. Upload or record 30–45
seconds of English speech and get an instant pronunciation score, with
specific words and phonemes highlighted so a learner knows exactly what to
practice.

**Live app:** https://frontend-khaki-sigma-66.vercel.app
**Repo:** https://github.com/AshrafAhmed9/pronounceright
**Architecture doc:** [`docs/architecture.pdf`](docs/architecture.pdf)

## What it does

1. Upload an audio file or record with your microphone (or try one of the two
   bundled samples — no setup needed to see it work).
2. Your browser trims/validates the 30–45s window and transcodes the audio to
   16kHz mono WAV entirely client-side.
3. The backend runs Azure AI Speech's Pronunciation Assessment (unscripted
   mode) to get accuracy, fluency, prosody, and completeness scores, plus
   per-word and per-phoneme accuracy.
4. An LLM (Gemini, falling back to Groq, falling back to a rule-based
   summarizer) turns the raw scores into plain-language coaching tips.
5. Results render as an overall score gauge, four sub-score tiles, a
   color-coded transcript (click any word for its phoneme breakdown, synced
   to audio playback), and an AI Coach panel.

## Project layout

```
frontend/   Next.js 16 (App Router, TypeScript, Tailwind v4) — deployed as its own Vercel project
api/        FastAPI (Python) — deployed as its own Vercel project
evals/      Labeled sample clips + a script that checks score consistency
docs/       Architecture document (source + rendered PDF)
```

Two separate Vercel projects (frontend and api, each rooted at its own
subdirectory of this monorepo) rather than one - see the architecture doc for
why.

## Running locally

### Backend

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in AZURE_SPEECH_KEY at minimum
uvicorn main:app --reload --port 8811
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://127.0.0.1:8811
npm run dev
```

Open http://localhost:3000 (adjust the port if it's taken locally).

### Environment variables

See `api/.env.example` for the full list. At minimum you need an Azure AI
Speech resource key + region (free F0 tier). Gemini/Groq keys are optional —
without them the coaching panel falls back to a deterministic rule-based
summary instead of failing.

## Evaluation harness

```bash
cd evals
pip install -r requirements.txt
EVAL_API_URL=http://127.0.0.1:8811 python run.py
```

Runs each labeled clip through the live pipeline 3x and reports score
consistency against the expectations in `labels.json`.

## Reliability

The deployed app is fronted by an external keep-alive pinger hitting `/health`
every 5 minutes so the API function stays warm, and the frontend fires a
background health-check the moment the page loads. See the architecture doc's
"Reliability" section for the full reasoning.

## Tech choices, at a glance

- **Azure AI Speech Pronunciation Assessment** over a DIY Whisper+phoneme
  pipeline — purpose-built scoring, free tier, phoneme-level detail.
- **Plain REST (httpx), not the Speech SDK** — smaller serverless bundle,
  faster cold starts, no native binary.
- **Client-side audio transcoding** — keeps uploads small and the backend
  format-agnostic.
- **Vercel** for both projects — no cold-start "sleep" like some free tiers,
  matches the JD's own stack.

Full reasoning, trade-offs, and the DPDP compliance approach are in
[`docs/architecture.pdf`](docs/architecture.pdf).
