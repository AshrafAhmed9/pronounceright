export type Band = "good" | "warning" | "critical";

export interface PhonemeScore {
  phoneme: string;
  accuracy_score: number;
}

export interface WordScore {
  word: string;
  accuracy_score: number;
  error_type: string;
  band: Band;
  offset_sec: number;
  duration_sec: number;
  phonemes: PhonemeScore[];
}

export interface PronunciationScores {
  overall: number;
  accuracy: number;
  fluency: number;
  prosody: number | null;
  completeness: number | null;
}

export interface CoachTip {
  issue: string;
  tip: string;
  example: string | null;
}

export interface CoachFeedback {
  summary: string;
  tips: CoachTip[];
  generated: boolean;
}

export interface AssessResponse {
  transcript: string;
  duration_sec: number;
  scores: PronunciationScores;
  words: WordScore[];
  coaching: CoachFeedback;
}

export interface ApiError {
  detail: string;
}
