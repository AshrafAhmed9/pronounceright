export const MIN_DURATION = 30;
export const MAX_DURATION = 45;
const TARGET_SAMPLE_RATE = 16000;
const DURATION_TOLERANCE = 0.5;

export class AudioValidationError extends Error {}

export interface ProcessedAudio {
  wav: Blob;
  durationSec: number;
}

/**
 * Decodes any browser-supported audio (upload or MediaRecorder output),
 * validates its length against the 30-45s window, and re-encodes it as
 * 16kHz mono 16-bit PCM WAV - the exact format Azure's short-audio speech
 * endpoint expects. Doing this in the browser keeps uploads small (~1.4MB for
 * 45s) and keeps the backend from ever having to touch a transcoder.
 */
export async function processAudioFile(file: Blob): Promise<ProcessedAudio> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtx();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    await tempCtx.close();
    throw new AudioValidationError(
      "This doesn't look like a valid audio file. Please try a different recording."
    );
  }
  await tempCtx.close();

  const duration = audioBuffer.duration;
  if (duration < MIN_DURATION - DURATION_TOLERANCE) {
    throw new AudioValidationError(
      `This recording is ${duration.toFixed(1)}s long. Please record at least 30 seconds.`
    );
  }
  if (duration > MAX_DURATION + DURATION_TOLERANCE) {
    throw new AudioValidationError(
      `This recording is ${duration.toFixed(1)}s long. Please keep it under 45 seconds.`
    );
  }

  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();

  const wav = encodeWavPCM16(rendered);
  return { wav, durationSec: duration };
}

function encodeWavPCM16(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export function pickBestRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
