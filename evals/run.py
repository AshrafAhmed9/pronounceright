"""Small evaluation harness for the pronunciation-assessment pipeline.

Posts each labeled clip in clips/ to a running API instance several times and
reports score consistency (Azure's acoustic scoring should be near-deterministic
for identical audio bytes) alongside the human-labeled expectation in
labels.json. This is meant as a lightweight sanity check, not a statistical
benchmark - see the architecture doc for how a larger eval set would extend
this (more clips, human-rated ground truth, inter-rater agreement).

Usage:
    pip install -r evals/requirements.txt
    EVAL_API_URL=http://127.0.0.1:8811 python evals/run.py
"""

from __future__ import annotations

import json
import os
import statistics
from pathlib import Path

import httpx

API_URL = os.environ.get("EVAL_API_URL", "http://127.0.0.1:8811").rstrip("/")
RUNS_PER_CLIP = 3
CLIPS_DIR = Path(__file__).parent / "clips"
LABELS_PATH = Path(__file__).parent / "labels.json"


def load_labels() -> dict[str, dict]:
    with open(LABELS_PATH) as f:
        return {entry["file"]: entry for entry in json.load(f)}


def assess_once(client: httpx.Client, wav_path: Path) -> dict:
    with open(wav_path, "rb") as f:
        files = {"file": (wav_path.name, f, "audio/wav")}
        data = {"consent": "true"}
        resp = client.post(f"{API_URL}/assess", files=files, data=data, timeout=60.0)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    labels = load_labels()
    wav_files = sorted(CLIPS_DIR.glob("*.wav"))
    if not wav_files:
        print(f"No .wav files found in {CLIPS_DIR}")
        return

    print(f"Evaluating against {API_URL}\n")

    with httpx.Client() as client:
        try:
            health = client.get(f"{API_URL}/health", timeout=10.0)
            health.raise_for_status()
        except Exception as exc:
            print(f"Could not reach API health check at {API_URL}/health: {exc}")
            return

        for wav_path in wav_files:
            label = labels.get(wav_path.name, {})
            print(f"=== {wav_path.name} ===")
            if label:
                print(f"  expected band: {label.get('expected_overall_band')}")
                print(f"  notes: {label.get('notes')}")

            overall_scores = []
            for run_idx in range(1, RUNS_PER_CLIP + 1):
                try:
                    result = assess_once(client, wav_path)
                except httpx.HTTPStatusError as exc:
                    print(f"  run {run_idx}: HTTP {exc.response.status_code} - {exc.response.text}")
                    continue
                except Exception as exc:
                    print(f"  run {run_idx}: request failed - {exc}")
                    continue

                scores = result["scores"]
                overall_scores.append(scores["overall"])
                print(
                    f"  run {run_idx}: overall={scores['overall']:.1f} "
                    f"accuracy={scores['accuracy']:.1f} fluency={scores['fluency']:.1f} "
                    f"prosody={scores['prosody']} completeness={scores['completeness']}"
                )
                print(f"           transcript: \"{result['transcript'][:80]}\"")

            if len(overall_scores) >= 2:
                spread = max(overall_scores) - min(overall_scores)
                stdev = statistics.stdev(overall_scores)
                flag = "  <-- high variance, investigate" if spread > 5 else ""
                print(f"  overall score spread across runs: {spread:.1f} (stdev {stdev:.2f}){flag}")
            print()


if __name__ == "__main__":
    main()
