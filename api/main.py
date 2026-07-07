from __future__ import annotations

import io
import logging
import os
import time
import wave
from collections import defaultdict, deque

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from azure_speech import AzureSpeechError, assess_pronunciation
from feedback import generate_coaching
from models import AssessResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pronounceright")

app = FastAPI(title="PronounceRight API", version="1.0.0")

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
_frontend_origins = os.environ.get("FRONTEND_ORIGIN", _default_origins)
ALLOWED_ORIGINS = [o.strip() for o in _frontend_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 6 * 1024 * 1024  # generous headroom over the ~1.4MB expected clip
MIN_DURATION_SEC = 29.0
MAX_DURATION_SEC = 46.0

# Best-effort per-IP rate limit. This is an in-memory sliding window, so it
# resets on cold start and isn't shared across concurrent instances - a
# courtesy limiter for this demo, not a security boundary. Production would
# back this with Redis or a gateway-level limiter.
RATE_LIMIT_MAX_REQUESTS = 15
RATE_LIMIT_WINDOW_SECONDS = 300
_request_log: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    window = _request_log[ip]
    while window and now - window[0] > RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a few minutes and try again.")
    window.append(now)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error while processing request")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our end. Please try again."})


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/assess", response_model=AssessResponse)
async def assess(request: Request, file: UploadFile = File(...), consent: str = Form(...)):
    _check_rate_limit(_client_ip(request))

    if consent.strip().lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=400, detail="Consent is required before we can process your audio.")

    audio_bytes = await file.read()

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The audio file is too large.")
    if audio_bytes[:4] != b"RIFF" or audio_bytes[8:12] != b"WAVE":
        raise HTTPException(status_code=400, detail="Please upload a WAV audio file.")

    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            duration = wf.getnframes() / float(wf.getframerate())
    except Exception:
        raise HTTPException(status_code=400, detail="This WAV file could not be read. Please try recording again.")

    if duration < MIN_DURATION_SEC:
        raise HTTPException(status_code=400, detail="Recording is too short. Please record 30 to 45 seconds of speech.")
    if duration > MAX_DURATION_SEC:
        raise HTTPException(status_code=400, detail="Recording is too long. Please record 30 to 45 seconds of speech.")

    try:
        transcript, scores, words = await assess_pronunciation(audio_bytes)
    except AzureSpeechError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    coaching = await generate_coaching(transcript, words, scores)

    return AssessResponse(
        transcript=transcript,
        duration_sec=duration,
        scores=scores,
        words=words,
        coaching=coaching,
    )
