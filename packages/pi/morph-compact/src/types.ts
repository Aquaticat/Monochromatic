/**
 * Types for Morph Compact pi extension.
 */

import type { CompactionResult, } from '@earendil-works/pi-coding-agent';

/** Metadata stored in the CompactionEntry details field. */
export type MorphCompactionDetails = {
  backend: 'morph';
  version: 1;
  query: string;
  compressionRatio: number;
  morphUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    compressionRatio?: number;
    processingTimeMs?: number;
  };
  compactedLineRanges?: {
    start: number;
    end: number;
  }[];
  readFiles: string[];
  modifiedFiles: string[];
};

/** Shape returned when Morph compaction succeeds. */
export type MorphCompactionSuccess = {
  kind: 'success';
  result: CompactionResult<MorphCompactionDetails>;
};

/** Shape returned when Morph compaction should fall through to pi default. */
export type MorphCompactionFallback = {
  kind: 'fallback';
};

/** Result of a Morph compaction attempt. */
export type MorphCompactionAttempt =
  | MorphCompactionSuccess
  | MorphCompactionFallback;
