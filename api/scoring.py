"""Shared scoring thresholds — the single source of truth for how a numeric
score or Azure error type maps to a good/warning/critical band. Both the word
heatmap and the overall gauge use this so the UI and the API never disagree.
"""

GOOD_MIN = 80
WARNING_MIN = 60


def band_for_score(score: float) -> str:
    if score >= GOOD_MIN:
        return "good"
    if score >= WARNING_MIN:
        return "warning"
    return "critical"


def band_for_word(accuracy_score: float, error_type: str) -> str:
    normalized = (error_type or "").strip().lower()
    if normalized not in ("", "none"):
        # Azure flags this word as a hard error (e.g. mispronunciation)
        # regardless of the numeric accuracy score.
        return "critical"
    return band_for_score(accuracy_score)
