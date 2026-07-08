# PronounceRight — AI Pronunciation Coach

This is my submission for the Livo AI Software Engineer assessment. You record
(or upload) 30-45 seconds of English speech and get back a pronunciation
score, with the specific words and sounds that need work highlighted, not
just a single number.

**Live app:** https://frontend-khaki-sigma-66.vercel.app
**Repo:** https://github.com/AshrafAhmed9/pronounceright
**Architecture doc:** [`docs/architecture.pdf`](docs/architecture.pdf)

## How it works

You upload a file, record with your mic, or just click one of the two sample
clips I bundled in (handy for testing without needing to record anything
yourself). The browser checks the 30-45s window and converts the audio to
16kHz mono WAV before it ever leaves your device. On the backend, Azure AI
Speech's Pronunciation Assessment does the actual scoring - accuracy,
fluency, prosody, completeness, plus per-word and per-phoneme detail. I then
send that transcript and those scores (never the raw audio) to an LLM to turn
them into plain-language coaching tips - Gemini first, Groq if that's down,
and a rule-based summary if both are unavailable, so the app never just
breaks because an LLM had a bad day.

The results page shows an overall score gauge, four sub-score tiles, a
transcript where every word is colored by how well it was pronounced (click
one to see its phoneme-by-phoneme breakdown, synced to audio playback), and
an AI coach panel with specific tips.

## Project layout

```
frontend/   Next.js 16 (App Router, TypeScript, Tailwind v4) - its own Vercel project
api/        FastAPI (Python) - its own Vercel project
evals/      Labeled sample clips + a script that checks score consistency
docs/       Architecture document (source + rendered PDF)
```

I split frontend and API into two separate Vercel projects rather than
bundling them into one - the reasoning is in the architecture doc.

## Running it locally

### Backend

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # you'll need at least AZURE_SPEECH_KEY
uvicorn main:app --reload --port 8811
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://127.0.0.1:8811
npm run dev
```

Then open http://localhost:3000 (or whatever port it picks if 3000 is busy).

### Environment variables

Full list is in `api/.env.example`. The only one you actually need is an
Azure AI Speech key + region (the free F0 tier is enough). Gemini and Groq
are optional - without them you just get the rule-based coaching tips
instead of LLM-written ones, everything else still works.

## Evaluation harness

```bash
cd evals
pip install -r requirements.txt
EVAL_API_URL=http://127.0.0.1:8811 python run.py
```

This runs each labeled clip through the live pipeline three times and checks
the scores come back consistent, and compares them against what I noted down
in `labels.json` when I made the clips.

## On reliability

Since this needs to work the moment someone opens the link (no second
chances), I've got an external monitor pinging `/health` every 5 minutes to
keep the API warm, and the frontend also fires its own background
health-check as soon as the page loads. More on why in the architecture
doc's reliability section.

## Why I built it this way

- **Azure AI Speech Pronunciation Assessment**, not a DIY Whisper + phoneme
  model pipeline - it's purpose-built for exactly this, free tier is enough,
  and it gives me phoneme-level scores out of the box.
- **Plain REST calls (httpx), not the Speech SDK** - the SDK is a native
  binary and makes for a heavier, slower-starting serverless bundle. A REST
  call is just easier to reason about too.
- **Audio gets transcoded client-side** - keeps uploads small and means the
  backend doesn't need to care what format you recorded in.
- **Vercel for both projects** - no cold-start sleep like some free hosts,
  and it happens to match the stack Livo already uses.

The full reasoning, the trade-offs I made, and how I've handled DPDP
compliance are all in [`docs/architecture.pdf`](docs/architecture.pdf).
