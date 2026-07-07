"""Thin REST client for Azure AI Speech's Pronunciation Assessment feature.

Deliberately uses plain HTTP (httpx) against the short-audio recognition
endpoint instead of the Speech SDK: the SDK is a native binary that bloats a
serverless bundle and slows cold starts, and its "continuous mode" (needed for
audio over Azure's ~30s single-shot limit) is a stateful streaming session that
is awkward to run inside a request/response function. See audio_chunk.py for
how longer clips are split and re-merged around that same 30s ceiling.
"""

from __future__ import annotations

import base64
import json
import os

import httpx

from audio_chunk import split_wav_if_needed
from models import PhonemeScore, PronunciationScores, WordScore
from scoring import band_for_word

AZURE_SPEECH_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.environ.get("AZURE_SPEECH_REGION", "")
AZURE_SPEECH_LANGUAGE = os.environ.get("AZURE_SPEECH_LANGUAGE", "en-US")

REQUEST_TIMEOUT_SECONDS = 25.0


class AzureSpeechError(Exception):
    """Raised when Azure's recognition/assessment can't produce a usable result."""


def _endpoint() -> str:
    return (
        f"https://{AZURE_SPEECH_REGION}.stt.speech.microsoft.com"
        "/speech/recognition/conversation/cognitiveservices/v1"
    )


def _pronunciation_assessment_header() -> str:
    config = {
        "ReferenceText": "",
        "GradingSystem": "HundredMark",
        "Granularity": "Phoneme",
        "Dimension": "Comprehensive",
        "EnableProsodyAssessment": "True",
        "PhonemeAlphabet": "IPA",
    }
    payload = json.dumps(config).encode("utf-8")
    return base64.b64encode(payload).decode("ascii")


async def _assess_single_chunk(client: httpx.AsyncClient, wav_bytes: bytes) -> dict:
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json",
        "Pronunciation-Assessment": _pronunciation_assessment_header(),
    }
    params = {"language": AZURE_SPEECH_LANGUAGE, "format": "detailed"}

    try:
        response = await client.post(
            _endpoint(),
            params=params,
            headers=headers,
            content=wav_bytes,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException as exc:
        raise AzureSpeechError("Speech service timed out. Please try again.") from exc
    except httpx.HTTPError as exc:
        raise AzureSpeechError("Could not reach the speech service.") from exc

    if response.status_code == 401 or response.status_code == 403:
        raise AzureSpeechError("Speech service authentication failed.")
    if response.status_code != 200:
        raise AzureSpeechError(
            f"Speech service returned an unexpected error (HTTP {response.status_code})."
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise AzureSpeechError("Speech service returned an invalid response.") from exc

    status = str(data.get("RecognitionStatus", "")).strip().lower()
    if status not in ("success", "0"):
        friendly = {
            "nomatch": "We couldn't detect recognizable English speech in this clip. Please try again with clearer audio.",
            "initialsilencetimeout": "The recording started with silence. Please try again and start speaking right away.",
            "babbletimeout": "We only detected background noise. Please record in a quieter environment.",
        }.get(status, "The speech service could not process this audio. Please try again.")
        raise AzureSpeechError(friendly)

    return data


def _pa(node: dict) -> dict:
    """Pronunciation-assessment fields can appear either flattened directly on
    the node (per the REST API reference) or nested under a
    'PronunciationAssessment' key (per some SDK-oriented docs/samples).
    Handle both shapes defensively since we can't unit-test against a shape
    we've only read about."""
    nested = node.get("PronunciationAssessment")
    if isinstance(nested, dict):
        merged = dict(node)
        merged.update(nested)
        return merged
    return node


def _parse_chunk(data: dict, offset_sec: float) -> tuple[str, PronunciationScores, list[WordScore], float]:
    nbest = data.get("NBest") or []
    if not nbest:
        raise AzureSpeechError("No speech was recognized in this clip.")

    best = nbest[0]
    best_pa = _pa(best)

    transcript = best.get("Display") or best.get("Lexical") or ""

    scores = PronunciationScores(
        overall=float(best_pa.get("PronScore", 0.0)),
        accuracy=float(best_pa.get("AccuracyScore", 0.0)),
        fluency=float(best_pa.get("FluencyScore", 0.0)),
        prosody=(float(best_pa["ProsodyScore"]) if best_pa.get("ProsodyScore") is not None else None),
        completeness=(float(best_pa["CompletenessScore"]) if best_pa.get("CompletenessScore") is not None else None),
    )

    words: list[WordScore] = []
    for w in best.get("Words", []):
        w_pa = _pa(w)
        accuracy = float(w_pa.get("AccuracyScore", 0.0))
        error_type = str(w_pa.get("ErrorType", "None"))

        phonemes: list[PhonemeScore] = []
        for p in w.get("Phonemes", []) or []:
            p_pa = _pa(p)
            phonemes.append(
                PhonemeScore(
                    phoneme=str(p.get("Phoneme", "")),
                    accuracy_score=float(p_pa.get("AccuracyScore", 0.0)),
                )
            )

        words.append(
            WordScore(
                word=str(w.get("Word", "")),
                accuracy_score=accuracy,
                error_type=error_type,
                band=band_for_word(accuracy, error_type),
                offset_sec=offset_sec + w.get("Offset", 0) / 10_000_000,
                duration_sec=w.get("Duration", 0) / 10_000_000,
                phonemes=phonemes,
            )
        )

    duration_sec = data.get("Duration", 0) / 10_000_000
    return transcript, scores, words, duration_sec


def _weighted_average(values_and_weights: list[tuple[float | None, float]]) -> float | None:
    present = [(v, w) for v, w in values_and_weights if v is not None and w > 0]
    if not present:
        return None
    total_weight = sum(w for _, w in present)
    if total_weight == 0:
        return None
    return sum(v * w for v, w in present) / total_weight


async def assess_pronunciation(wav_bytes: bytes) -> tuple[str, PronunciationScores, list[WordScore]]:
    """Runs pronunciation assessment on a 16kHz mono PCM16 WAV clip.

    Clips longer than the safe single-call limit are transparently split into
    two chunks (see audio_chunk.py) and the results are merged: transcripts
    are concatenated, word offsets are shifted into the merged timeline, and
    full-utterance scores are combined as a duration-weighted average.
    """
    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        raise AzureSpeechError("Speech service is not configured.")

    chunks = split_wav_if_needed(wav_bytes)

    async with httpx.AsyncClient() as client:
        raw_results = []
        for chunk_bytes, offset_sec in chunks:
            data = await _assess_single_chunk(client, chunk_bytes)
            raw_results.append((data, offset_sec))

    parsed = [_parse_chunk(data, offset_sec) for data, offset_sec in raw_results]

    if len(parsed) == 1:
        transcript, scores, words, _ = parsed[0]
        return transcript, scores, words

    transcripts = [p[0] for p in parsed if p[0]]
    merged_transcript = " ".join(transcripts)

    merged_words: list[WordScore] = []
    for _, _, words, _ in parsed:
        merged_words.extend(words)

    merged_scores = PronunciationScores(
        overall=_weighted_average([(scores.overall, dur) for _, scores, _, dur in parsed]) or 0.0,
        accuracy=_weighted_average([(scores.accuracy, dur) for _, scores, _, dur in parsed]) or 0.0,
        fluency=_weighted_average([(scores.fluency, dur) for _, scores, _, dur in parsed]) or 0.0,
        prosody=_weighted_average([(scores.prosody, dur) for _, scores, _, dur in parsed]),
        completeness=_weighted_average([(scores.completeness, dur) for _, scores, _, dur in parsed]),
    )

    return merged_transcript, merged_scores, merged_words
