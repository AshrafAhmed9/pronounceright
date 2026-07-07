from __future__ import annotations

from pydantic import BaseModel, Field


class PhonemeScore(BaseModel):
    phoneme: str
    accuracy_score: float


class WordScore(BaseModel):
    word: str
    accuracy_score: float
    error_type: str
    band: str  # "good" | "warning" | "critical"
    offset_sec: float
    duration_sec: float
    phonemes: list[PhonemeScore] = Field(default_factory=list)


class PronunciationScores(BaseModel):
    overall: float
    accuracy: float
    fluency: float
    prosody: float | None = None
    completeness: float | None = None


class CoachTip(BaseModel):
    issue: str
    tip: str
    example: str | None = None


class CoachFeedback(BaseModel):
    summary: str
    tips: list[CoachTip]
    generated: bool


class AssessResponse(BaseModel):
    transcript: str
    duration_sec: float
    scores: PronunciationScores
    words: list[WordScore]
    coaching: CoachFeedback


class ErrorResponse(BaseModel):
    detail: str
