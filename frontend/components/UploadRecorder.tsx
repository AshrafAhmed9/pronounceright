"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_DURATION, MIN_DURATION, pickBestRecorderMimeType, processAudioFile } from "@/lib/audioProcessing";

interface UploadRecorderProps {
  consentGiven: boolean;
  onConsentChange: (value: boolean) => void;
  onAudioReady: (wav: Blob, durationSec: number, sourceLabel: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const SAMPLES = [
  {
    id: "clear",
    file: "/samples/sample-clear-pace.wav",
    label: "Sample A — Clear, natural pace",
    description: "A native-paced reading. Expect strong scores across the board.",
  },
  {
    id: "rapid",
    file: "/samples/sample-rapid-speech.wav",
    label: "Sample B — Rapid speech",
    description: "Same script, spoken much faster. Watch fluency and prosody dip.",
  },
];

export function UploadRecorder({
  consentGiven,
  onConsentChange,
  onAudioReady,
  onError,
  disabled,
}: UploadRecorderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [busySampleId, setBusySampleId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const handleBlobReady = useCallback(
    async (blob: Blob, sourceLabel: string) => {
      setIsPreparing(true);
      try {
        const { wav, durationSec } = await processAudioFile(blob);
        onAudioReady(wav, durationSec, sourceLabel);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not process this audio.");
      } finally {
        setIsPreparing(false);
        setBusySampleId(null);
      }
    },
    [onAudioReady, onError]
  );

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopTimer();
    setIsRecording(false);
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    if (!consentGiven) {
      onError("Please accept the consent notice before recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickBestRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType ?? "audio/webm" });
        void handleBlobReady(blob, "Microphone recording");
      };

      recorder.start();
      setIsRecording(true);
      setElapsedSec(0);

      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1;
          if (next >= MAX_DURATION) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      onError("Microphone access was denied or is unavailable. Try uploading a file instead.");
    }
  }, [consentGiven, handleBlobReady, onError, stopRecording]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!consentGiven) {
        onError("Please accept the consent notice before uploading.");
        return;
      }
      const file = files[0];
      void handleBlobReady(file, `Uploaded file: ${file.name}`);
    },
    [consentGiven, handleBlobReady, onError]
  );

  const handleSample = useCallback(
    async (sampleId: string, path: string, label: string) => {
      if (!consentGiven) {
        onError("Please accept the consent notice before trying a sample.");
        return;
      }
      setBusySampleId(sampleId);
      try {
        const resp = await fetch(path);
        const blob = await resp.blob();
        await handleBlobReady(blob, label);
      } catch {
        onError("Could not load the sample clip.");
        setBusySampleId(null);
      }
    },
    [consentGiven, handleBlobReady, onError]
  );

  const busy = disabled || isPreparing || isRecording;

  return (
    <div className="flex flex-col gap-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-[var(--text-secondary)]">
          I consent to my audio being processed for pronunciation analysis. It is analyzed in
          memory and never stored. See the{" "}
          <Link href="/privacy" className="text-[var(--accent)] underline">
            privacy notice
          </Link>
          .
        </span>
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
        style={{
          borderColor: isDragOver ? "var(--accent)" : "var(--gridline)",
          backgroundColor: isDragOver ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--surface-2)",
        }}
      >
        <p className="text-[var(--text-primary)]">Drag and drop an audio file here</p>
        <p className="text-sm text-[var(--text-secondary)]">30–45 seconds of clear English speech</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="mt-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-opacity disabled:opacity-50"
        >
          Choose a file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--gridline)]" />
        <span className="text-xs text-[var(--text-muted)]">or</span>
        <div className="h-px flex-1 bg-[var(--gridline)]" />
      </div>

      <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
        {isRecording ? (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--status-critical)]" />
              <span className="tabular-nums text-lg font-medium text-[var(--text-primary)]">
                {elapsedSec}s
              </span>
              <span className="text-sm text-[var(--text-secondary)]">/ {MAX_DURATION}s max</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              disabled={elapsedSec < MIN_DURATION}
              className="mt-1 rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--status-critical)" }}
            >
              {elapsedSec < MIN_DURATION ? `Stop (available at ${MIN_DURATION}s)` : "Stop recording"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={startRecording}
            className="rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Record with microphone
          </button>
        )}
        {isPreparing && (
          <p className="text-sm text-[var(--text-secondary)]">Preparing your audio…</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--gridline)]" />
        <span className="text-xs text-[var(--text-muted)]">or try a sample</span>
        <div className="h-px flex-1 bg-[var(--gridline)]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            disabled={busy || busySampleId !== null}
            onClick={() => handleSample(sample.id, sample.file, sample.label)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left transition-opacity disabled:opacity-50"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {busySampleId === sample.id ? "Loading…" : sample.label}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{sample.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
