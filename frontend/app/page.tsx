"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachPanel } from "@/components/CoachPanel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PhonemePanel } from "@/components/PhonemePanel";
import { ProgressSteps } from "@/components/ProgressSteps";
import { ScoreGauge } from "@/components/ScoreGauge";
import { StatTile } from "@/components/StatTile";
import { TranscriptView } from "@/components/TranscriptView";
import { UploadRecorder } from "@/components/UploadRecorder";
import { assessRecording, pingHealth } from "@/lib/api";
import type { AssessResponse } from "@/lib/types";

type AppState = "idle" | "processing" | "results";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [consentGiven, setConsentGiven] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AssessResponse | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    pingHealth();
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const handleAudioReady = useCallback(async (wav: Blob, _durationSec: number, label: string) => {
    setErrorMessage(null);
    setSourceLabel(label);

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(wav);
    audioUrlRef.current = url;
    setAudioUrl(url);

    setAppState("processing");
    try {
      const response = await assessRecording(wav, true);
      setResult(response);
      setSelectedWordIndex(null);
      setAppState("results");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setAppState("idle");
    }
  }, []);

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const handleReset = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
    setResult(null);
    setErrorMessage(null);
    setSelectedWordIndex(null);
    setActiveWordIndex(null);
    setAppState("idle");
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!result || !audioRef.current) return;
    const t = audioRef.current.currentTime;
    const idx = result.words.findIndex((w) => t >= w.offset_sec && t < w.offset_sec + w.duration_sec);
    setActiveWordIndex(idx >= 0 ? idx : null);
  }, [result]);

  const handleWordClick = useCallback(
    (index: number) => {
      setSelectedWordIndex(index);
      if (result && audioRef.current) {
        audioRef.current.currentTime = result.words[index].offset_sec;
      }
    },
    [result]
  );

  const selectedWord = useMemo(
    () => (result && selectedWordIndex !== null ? result.words[selectedWordIndex] : null),
    [result, selectedWordIndex]
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {appState === "idle" && (
        <>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold text-[var(--text-primary)]">
              Get instant feedback on your English pronunciation
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[var(--text-secondary)]">
              Upload or record 30–45 seconds of speech. We&apos;ll score your accuracy, fluency,
              and rhythm, and highlight exactly which words and sounds to work on.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6">
              <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />
            </div>
          )}

          <UploadRecorder
            consentGiven={consentGiven}
            onConsentChange={setConsentGiven}
            onAudioReady={handleAudioReady}
            onError={handleError}
          />
        </>
      )}

      {appState === "processing" && (
        <div className="py-10">
          <ProgressSteps />
        </div>
      )}

      {appState === "results" && result && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--text-secondary)]">{sourceLabel}</p>
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 self-start rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-medium text-[var(--text-primary)] sm:self-auto"
            >
              Analyze another recording
            </button>
          </div>

          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full"
            />
          )}

          <div className="flex justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-8">
            <ScoreGauge score={result.scores.overall} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Accuracy" value={result.scores.accuracy} />
            <StatTile label="Fluency" value={result.scores.fluency} />
            <StatTile label="Prosody" value={result.scores.prosody} />
            <StatTile label="Completeness" value={result.scores.completeness} />
          </div>

          <TranscriptView
            words={result.words}
            selectedIndex={selectedWordIndex}
            activeIndex={activeWordIndex}
            onWordClick={handleWordClick}
          />

          <PhonemePanel word={selectedWord} />

          <CoachPanel coaching={result.coaching} />
        </div>
      )}
    </div>
  );
}
