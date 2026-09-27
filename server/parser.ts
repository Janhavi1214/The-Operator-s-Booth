/**
 * server/parser.ts — Notice Parsing & Zod Validation
 *
 * Phase 2: Core Logic & Schema Validation
 * - Zod schema for structured notice output (Test 9)
 * - parseNotice() extracts fields from messy text via regex
 * - Validation failures throw; callers return 422 (Test 7)
 */

import { z } from "zod";

// ──────────────────────────────────────────────────────────────
//  ZOD SCHEMA — the single source of truth for notice shape
// ──────────────────────────────────────────────────────────────

export const NoticeSchema = z.object({
  /** Train identifier, e.g. "IC 724", "RE 3", "TGV 9201" */
  train: z
    .string()
    .min(1, "train must be a non-empty string"),

  /** Station name, e.g. "Monaco Monte-Carlo" */
  station: z
    .string()
    .min(1, "station must be a non-empty string"),

  /** Expected arrival/departure time, e.g. "14:32", "08:05" */
  expected_time: z
    .string()
    .min(1, "expected_time must be a non-empty string"),

  /** Human-readable delay/cancellation reason (optional) */
  reason: z.string().optional(),
});

/** TypeScript type inferred from the schema. */
export type Notice = z.infer<typeof NoticeSchema>;

// ──────────────────────────────────────────────────────────────
//  CUSTOM ERROR — thrown when raw text can't be parsed at all
// ──────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

// ──────────────────────────────────────────────────────────────
//  REGEX EXTRACTION HELPERS
// ──────────────────────────────────────────────────────────────

/**
 * Attempt to pull a train identifier from messy text.
 *
 * Matches patterns like:
 *   "Train IC 724", "train: RE 3", "TGV 9201", "S1", "RB 48"
 *   Also handles bare "Train 42" or "train #42".
 */
function extractTrain(text: string): string | null {
  // Pattern: optional "train" label, then 1-4 uppercase letters + digits
  const patterns: RegExp[] = [
    /(?:train\s*[:#]?\s*)([A-Z]{1,5}\s*\d{1,5})/i,
    /\b([A-Z]{1,5}\s*\d{1,5})\b/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Attempt to pull a station name.
 *
 * Matches patterns like:
 *   "station: Monaco Monte-Carlo"
 *   "at Monaco Monte-Carlo"
 *   "Station Monaco"
 */
function extractStation(text: string): string | null {
  // First check explicit "station:" or "station" pattern up to keywords like expected, due, time, or punctuation
  const stationPattern = /(?:station\s*[:#]?\s*)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-''.]+?)(?=\s+(?:expected|due|because|delayed|cancelled|train|#|\d{1,2}:\d{2})|[,.\n]|$)/i;
  let m = text.match(stationPattern);
  if (m) return m[1].trim();

  // Next check "at <Station>" up to keywords like expected, due to, etc.
  // Ignore "expected at <time>" or "at <time>"
  const atPattern = /(?:(?:^|\s)at\s+)(?!\d{1,2}:\d{2})([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-''.]+?)(?=\s+(?:expected|due|because|delayed|cancelled|train|#|\d{1,2}:\d{2})|[,.\n]|$)/i;
  m = text.match(atPattern);
  if (m) {
    let result = m[1].trim();
    // Strip leading "Station " if captured
    result = result.replace(/^station\s+/i, "");
    return result;
  }

  return null;
}

/**
 * Attempt to pull a time string (HH:MM, optionally with seconds).
 *
 * Matches: "14:32", "08:05:00", "expected at 14:32"
 */
function extractTime(text: string): string | null {
  const m = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  return m ? m[1] : null;
}

/**
 * Attempt to pull a delay/cancellation reason.
 *
 * Matches patterns like:
 *   "reason: signal failure"
 *   "due to weather conditions"
 *   "because of track maintenance"
 *   "delayed by crew shortage"
 *   "cancelled due to flooding"
 */
function extractReason(text: string): string | undefined {
  const patterns: RegExp[] = [
    /(?:reason\s*[:#]?\s*)(.+?)(?:\.|$)/im,
    /(?:due\s+to\s+)(.+?)(?:\.|$)/im,
    /(?:because\s+of\s+)(.+?)(?:\.|$)/im,
    /(?:delayed\s+by\s+)(.+?)(?:\.|$)/im,
    /(?:cancelled?\s+(?:due\s+to|because\s+of)\s+)(.+?)(?:\.|$)/im,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return undefined;
}

// ──────────────────────────────────────────────────────────────
//  PUBLIC API
// ──────────────────────────────────────────────────────────────

/**
 * Parse a messy free-text train notice into a validated `Notice` object.
 *
 * @param rawText  Raw announcement text (e.g., scraped LCD board, PA transcript)
 * @returns A Zod-validated {@link Notice} object
 *
 * @throws {ParseError}  When required fields cannot be extracted from the text
 * @throws {z.ZodError}  When extracted values fail schema validation
 */
export function parseNotice(rawText: string): Notice {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new ParseError("Input text is empty or not a string");
  }

  const train = extractTrain(rawText);
  const station = extractStation(rawText);
  const expectedTime = extractTime(rawText);
  const reason = extractReason(rawText);

  // Fail fast if we couldn't extract the mandatory fields
  const missing: string[] = [];
  if (!train) missing.push("train");
  if (!station) missing.push("station");
  if (!expectedTime) missing.push("expected_time");

  if (missing.length > 0) {
    throw new ParseError(
      `Could not extract required field(s): ${missing.join(", ")} from input text`
    );
  }

  // At this point TypeScript knows these are non-null, but Zod gives us
  // the runtime guarantee and the canonical type.
  const raw = {
    train: train!,
    station: station!,
    expected_time: expectedTime!,
    ...(reason !== undefined && { reason }),
  };

  // Throws ZodError if validation fails
  return NoticeSchema.parse(raw);
}
