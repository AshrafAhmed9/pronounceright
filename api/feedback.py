"""Turns raw Azure scores into learner-friendly coaching tips.

Tries Gemini first, falls back to Groq, and falls back again to a deterministic
rule-based summary if both LLMs are unavailable or misbehave. The /assess
endpoint must never fail just because the coaching layer had a bad day - a
learner still gets their scores and highlighted words either way.
"""

from __future__ import annotations

import json
import os

import httpx

from models import CoachFeedback, CoachTip, PronunciationScores, WordScore

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

LLM_TIMEOUT_SECONDS = 12.0
MAX_WORDS_IN_PROMPT = 10

RESPONSE_SCHEMA_HINT = (
    "Respond with ONLY minified JSON matching this exact shape, no markdown "
    'fences: {"summary": string, "tips": [{"issue": string, "tip": string, '
    '"example": string|null}]}. Provide at most 3 tips.'
)


def _build_prompt(transcript: str, words: list[WordScore], scores: PronunciationScores) -> str:
    weak_words = sorted(
        (w for w in words if w.band != "good"),
        key=lambda w: w.accuracy_score,
    )[:MAX_WORDS_IN_PROMPT]

    weak_words_desc = (
        "\n".join(
            f"- \"{w.word}\": accuracy {w.accuracy_score:.0f}/100, error_type={w.error_type}"
            for w in weak_words
        )
        or "(no individual words flagged - overall fluency/prosody may still need work)"
    )

    return (
        "You are a supportive, encouraging English pronunciation coach. A learner just "
        "recorded themselves speaking and an automated system scored it.\n\n"
        f'Transcript (what they said): "{transcript}"\n\n'
        f"Scores (0-100): overall={scores.overall:.0f}, accuracy={scores.accuracy:.0f}, "
        f"fluency={scores.fluency:.0f}, prosody={scores.prosody if scores.prosody is not None else 'n/a'}, "
        f"completeness={scores.completeness if scores.completeness is not None else 'n/a'}\n\n"
        f"Words that scored lowest or were flagged:\n{weak_words_desc}\n\n"
        "Write a short (1-2 sentence) encouraging summary of how they did, then up to 3 "
        "concrete, specific tips. Each tip should name the actual issue (e.g. a specific word "
        "or the fluency/prosody score), explain briefly what went wrong, and give a practical "
        "way to practice it (a minimal-pair example word or a rhythm/breathing tip). Keep "
        "language simple and kind - this is for a language learner, not a linguist.\n\n"
        + RESPONSE_SCHEMA_HINT
    )


def _parse_llm_json(raw_text: str) -> CoachFeedback:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    data = json.loads(cleaned)
    tips = [
        CoachTip(
            issue=str(t.get("issue", "")),
            tip=str(t.get("tip", "")),
            example=t.get("example"),
        )
        for t in data.get("tips", [])
    ]
    return CoachFeedback(summary=str(data.get("summary", "")), tips=tips, generated=True)


async def _try_gemini(prompt: str) -> CoachFeedback | None:
    if not GEMINI_API_KEY:
        return None
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                json=body,
                timeout=LLM_TIMEOUT_SECONDS,
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return _parse_llm_json(text)
    except Exception:
        return None


async def _try_groq(prompt: str) -> CoachFeedback | None:
    if not GROQ_API_KEY:
        return None
    body = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0.4,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json=body,
                timeout=LLM_TIMEOUT_SECONDS,
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return _parse_llm_json(text)
    except Exception:
        return None


def _rule_based_fallback(words: list[WordScore], scores: PronunciationScores) -> CoachFeedback:
    weak_words = sorted((w for w in words if w.band != "good"), key=lambda w: w.accuracy_score)[:3]

    tips: list[CoachTip] = []
    for w in weak_words:
        tips.append(
            CoachTip(
                issue=f'The word "{w.word}" scored {w.accuracy_score:.0f}/100',
                tip=f'Slow down and say "{w.word}" on its own a few times, exaggerating each syllable, then place it back in the sentence.',
                example=None,
            )
        )

    if scores.fluency < 70:
        tips.append(
            CoachTip(
                issue=f"Fluency scored {scores.fluency:.0f}/100",
                tip="Practice reading the sentence aloud slowly, pausing naturally at commas and periods, before speeding up to a comfortable pace.",
                example=None,
            )
        )
    if scores.prosody is not None and scores.prosody < 70:
        tips.append(
            CoachTip(
                issue=f"Prosody (rhythm/intonation) scored {scores.prosody:.0f}/100",
                tip="Try exaggerating the rise and fall of your voice on stressed words - reading it like a question, then like an excited statement, can help you feel the difference.",
                example=None,
            )
        )

    if not tips:
        tips.append(
            CoachTip(
                issue="Overall performance",
                tip="Great job - keep practicing with longer, more varied sentences to challenge yourself further.",
                example=None,
            )
        )

    summary = (
        f"You scored {scores.overall:.0f}/100 overall. "
        + ("Solid work overall with a few specific spots to polish." if scores.overall >= 70 else "There's a clear path to improve - focus on the tips below.")
    )

    return CoachFeedback(summary=summary, tips=tips[:3], generated=False)


async def generate_coaching(
    transcript: str, words: list[WordScore], scores: PronunciationScores
) -> CoachFeedback:
    prompt = _build_prompt(transcript, words, scores)

    result = await _try_gemini(prompt)
    if result is not None:
        return result

    result = await _try_groq(prompt)
    if result is not None:
        return result

    return _rule_based_fallback(words, scores)
