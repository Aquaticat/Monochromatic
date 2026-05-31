/**
 * Viewer-local data types derived from enriched artifacts.
 *
 * Replaces the runner's deleted `HistoryEntry` and `HistoryFile` types
 * with types that match the artifact-based data model.
 */
import type {
  ConfigSnapshot,
  StreamTiming,
  StreamUsage,
} from '@monochromatic-dev/dev-script-inference-canary/ts';

export type {
  ConfigSnapshot,
  OpenRouterModelId,
  StreamTiming,
  StreamUsage,
} from '@monochromatic-dev/dev-script-inference-canary/ts';

/**
 * A single run entry derived from artifact metadata.
 * Replaces the runner's deleted `HistoryEntry` type.
 *
 * @example
 * ```ts
 * const entry: ViewerEntry = {
 *   timestamp: '2026-03-06T12:00:00.000Z',
 *   model: 'anthropic/claude-sonnet-4.6',
 *   overallScore: 0.85,
 *   probeScores: { 'csv-rfc4180': 0.9, 'css-mixin': 0.8 },
 *   pass2Scores: { 'csv-rfc4180': 0.95 },
 *   failed: false,
 * };
 * ```
 */
export type ViewerEntry = {
  readonly timestamp: string;
  /**
   * OpenRouter model ID for vendor color/icon resolution
   */
  readonly model: string;
  /**
   * Human-readable model label for display and grouping
   */
  readonly label: string;
  /**
   * Mean of per-probe pass-1 scores, 0 for failed runs
   */
  readonly overallScore: number;
  /**
   * Per-probe pass-1 scores keyed by probe name
   */
  readonly probeScores: Readonly<Record<string, number>>;
  /**
   * Per-probe pass-2 (fix) scores, absent for probes without a fix pass
   */
  readonly pass2Scores?: Readonly<Record<string, number>>;
  /**
   * Whether this run was a whole-model failure (no probes executed)
   */
  readonly failed: boolean;
  /**
   * Error message for failed runs
   */
  readonly error?: string;
  /**
   * Runner configuration snapshot, present for enriched artifacts
   */
  readonly config?: ConfigSnapshot;
};

/**
 * Per-probe enriched detail data for overlays.
 * Combines initial-pass and fix-pass artifact data for a single probe run.
 * Fields are optional to gracefully handle old pre-enrichment artifacts.
 *
 * @example
 * ```ts
 * const detail: ProbeDetail = {
 *   score: 0.85,
 *   reasoning: 'Let me think...',
 *   timing: { timeToFirstChunkMs: 1234, interChunkMs: [], totalMs: 15000, chunkCount: 200 },
 *   usage: { promptTokens: 500, completionTokens: 2000, totalTokens: 2500 },
 *   initialDir: '/path/to/initial',
 * };
 * ```
 */
export type ProbeDetail = {
  /**
   * Probe score, undefined for old artifacts without enrichment
   */
  readonly score?: number;
  /**
   * Fix-pass score
   */
  readonly pass2Score?: number;
  /**
   * Model reasoning/thinking trace from initial pass
   */
  readonly reasoning?: string;
  /**
   * Timing breakdown from initial pass
   */
  readonly timing?: StreamTiming;
  /**
   * Token usage from initial pass
   */
  readonly usage?: StreamUsage;
  /**
   * Why generation stopped on initial pass
   */
  readonly finishReason?: string;
  /**
   * Runner configuration snapshot
   */
  readonly config?: ConfigSnapshot;
  /**
   * Diagnostic prompt sent for the fix pass
   */
  readonly fixPrompt?: string;
  /**
   * Model reasoning/thinking trace from fix pass
   */
  readonly fixReasoning?: string;
  /**
   * Timing breakdown from fix pass
   */
  readonly fixTiming?: StreamTiming;
  /**
   * Token usage from fix pass
   */
  readonly fixUsage?: StreamUsage;
  /**
   * Why generation stopped on fix pass
   */
  readonly fixFinishReason?: string;
  /**
   * Raw model response from initial pass response.txt
   */
  readonly initialResponse?: string;
  /**
   * Raw model response from fix pass response.txt
   */
  readonly fixResponse?: string;
  /**
   * TypeScript source from initial pass canary.ts
   */
  readonly initialSource?: string;
  /**
   * TypeScript source from fix pass canary.ts
   */
  readonly fixSource?: string;
  /**
   * Absolute path to initial pass artifact directory
   */
  readonly initialDir: string;
  /**
   * Absolute path to fix pass artifact directory
   */
  readonly fixDir?: string;
  /**
   * True when initial pass was partial/aborted
   */
  readonly partial?: boolean;
  /**
   * Error message from initial pass
   */
  readonly error?: string;
};

/**
 * Whether a run tested more than one probe.
 *
 * Single-probe runs produce artificially high overall scores because the easy
 * probe (e.g. stak-simulation) dominates the average. These should be excluded
 * from overall-score charts and threshold calculations.
 *
 * @param entry - viewer entry to check
 *
 * @returns true when the run tested at least 2 probes
 *
 * @example
 * ```ts
 * entries.filter(hasMultipleProbes); // only runs with meaningful overall scores
 * ```
 */
export function hasMultipleProbes(entry: ViewerEntry,): boolean {
  return Object.keys(entry.probeScores,)
    .length
    >= 2;
}

/**
 * Result of reading all artifacts
 */
export type ArtifactData = {
  /**
   * Run entries suitable for charts and tables
   */
  readonly entries: readonly ViewerEntry[];
  /**
   * Per-probe detail data keyed by `model::probe::timestamp`
   */
  readonly probeDetails: ReadonlyMap<string, ProbeDetail>;
};
