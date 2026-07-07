"""WAV inspection and splitting utilities.

Azure's short-audio (single-shot) speech recognition endpoint is reliable up to
roughly 30 seconds of audio; beyond that, Microsoft's own SDK quickstarts say to
switch to "continuous mode" (a stateful, multi-event streaming API). Rather than
depend on a WebSocket-based streaming session from a serverless function - which
is fragile to keep alive and hard to reason about under cold starts - we split
any clip longer than our safe single-call limit into two sub-30s chunks at a
naturally quiet point (a pause between words), call the plain REST endpoint once
per chunk (in parallel), and stitch the results back together. Plain HTTP POST
requests are what make the reliability guarantee in this app possible.

Pure stdlib: `audioop` was removed in Python 3.13, so energy detection is done
by hand with `array` instead.
"""

from __future__ import annotations

import io
import wave
from array import array
from dataclasses import dataclass

SAFE_SINGLE_CALL_SECONDS = 28.0
SEARCH_WINDOW_SECONDS = 3.0
FRAME_MS = 20


@dataclass
class WavInfo:
    sample_rate: int
    channels: int
    sample_width: int
    num_frames: int

    @property
    def duration_sec(self) -> float:
        return self.num_frames / float(self.sample_rate)


def read_wav_info(wav_bytes: bytes) -> WavInfo:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        return WavInfo(
            sample_rate=wf.getframerate(),
            channels=wf.getnchannels(),
            sample_width=wf.getsampwidth(),
            num_frames=wf.getnframes(),
        )


def _read_samples(wav_bytes: bytes) -> tuple[WavInfo, array]:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        info = WavInfo(
            sample_rate=wf.getframerate(),
            channels=wf.getnchannels(),
            sample_width=wf.getsampwidth(),
            num_frames=wf.getnframes(),
        )
        if info.sample_width != 2:
            raise ValueError("Expected 16-bit PCM WAV audio")
        raw = wf.readframes(info.num_frames)
    samples = array("h")
    samples.frombytes(raw)
    return info, samples


def _write_wav(info: WavInfo, samples: array) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(info.channels)
        wf.setsampwidth(info.sample_width)
        wf.setframerate(info.sample_rate)
        wf.writeframes(samples.tobytes())
    return buf.getvalue()


def _quietest_split_index(samples: array, channels: int, sample_rate: int) -> int:
    """Find the sample index (frame-aligned) of lowest short-term energy near
    the midpoint, so the split falls in a natural pause rather than mid-word."""
    total_frames = len(samples) // channels
    frame_len = max(1, int(sample_rate * FRAME_MS / 1000))
    mid_frame = total_frames // 2
    window_frames = int(sample_rate * SEARCH_WINDOW_SECONDS)
    lo = max(frame_len, mid_frame - window_frames)
    hi = min(total_frames - frame_len, mid_frame + window_frames)

    if lo >= hi:
        return mid_frame

    best_frame = mid_frame
    best_energy = None
    step = frame_len
    pos = lo
    while pos < hi:
        start = pos * channels
        end = start + frame_len * channels
        chunk = samples[start:end]
        if not chunk:
            break
        energy = sum(s * s for s in chunk) / len(chunk)
        if best_energy is None or energy < best_energy:
            best_energy = energy
            best_frame = pos
        pos += step

    return best_frame


def split_wav_if_needed(wav_bytes: bytes) -> list[tuple[bytes, float]]:
    """Return a list of (wav_bytes, offset_sec) chunks. offset_sec is where
    this chunk begins within the original clip, used to re-align word
    timestamps after merging. A single-element list means no split occurred."""
    info, samples = _read_samples(wav_bytes)
    if info.duration_sec <= SAFE_SINGLE_CALL_SECONDS:
        return [(wav_bytes, 0.0)]

    split_frame = _quietest_split_index(samples, info.channels, info.sample_rate)
    split_sample = split_frame * info.channels

    first = samples[:split_sample]
    second = samples[split_sample:]

    first_wav = _write_wav(info, first)
    second_wav = _write_wav(info, second)
    offset_sec = split_frame / float(info.sample_rate)

    return [(first_wav, 0.0), (second_wav, offset_sec)]
