import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { buildCriticMessages, } from './critic-prompt.ts';
import {
  parseDocument,
  type RepairDocument,
} from './parse-document.ts';
import {
  applySeededErrors,
  type SeededErrorApplication,
  type SeededErrorSpec,
} from './seeded-error.ts';

//region Benchmark entry preparation
// Pure per-entry preparation shared by every model attempt: seed planting,
// parsing, prompt construction, and planted-id extraction happen once per
// entry, never once per call.

/**
 * One corpus entry prepared for benchmarking.
 *
 * @example
 * ```ts
 * const entry: BenchmarkEntry = {
 *   entryId: 'whiskers',
 *   sourceText: zh,
 *   targetText: en,
 *   seeds: deriveOmissionSeeds({ text: enBody, maxSeeds: 2, },),
 * };
 * ```
 */
export type BenchmarkEntry = {
  /**
   * Corpus entry id, e.g. the `people/<id>` directory name.
   */
  readonly entryId: string;

  /**
   * Original document, front matter included.
   */
  readonly sourceText: string;

  /**
   * Clean translation; seeds are planted into it here.
   */
  readonly targetText: string;

  /**
   * Errors to plant, in application order.
   */
  readonly seeds: readonly SeededErrorSpec[];
};

/**
 * Entry with its seeded pair parsed and its prompt built,
 * ready for any number of model attempts.
 */
export type PreparedEntry = {
  /**
   * Corpus entry id carried onto every record.
   */
  readonly entryId: string;

  /**
   * Parsed pair every claim of this entry anchors against.
   */
  readonly documents: {
    readonly source: RepairDocument;
    readonly target: RepairDocument;
  };

  /**
   * Prompt shared by every model for this entry.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Planted regions in seeded-text coordinates.
   */
  readonly applications: readonly SeededErrorApplication[];

  /**
   * Planted ids repeated on every record of this entry.
   */
  readonly plantedSeedIds: readonly string[];
};

/**
 * Prepares one entry for benchmarking:
 * plants its seeds, parses both sides, and builds the shared prompt.
 *
 * @param entry - corpus entry with seeds
 *
 * @returns Entry ready for model attempts
 *
 * @throws {@link import('./seeded-error.ts').SeedApplicationError} when a seed spec is misconfigured
 *
 * @example
 * ```ts
 * const prepared = prepareBenchmarkEntry({ entry, },);
 * ```
 */
export function prepareBenchmarkEntry(
  { entry, }: { readonly entry: BenchmarkEntry; },
): PreparedEntry {
  /**
   * Seeded translation and its planted regions.
   */
  const {
    seededText,
    applications,
  } = applySeededErrors({
    text: entry.targetText,
    specs: entry.seeds,
  },);

  return {
    entryId: entry.entryId,
    documents: {
      source: parseDocument({ text: entry.sourceText, },),
      target: parseDocument({ text: seededText, },),
    },
    messages: buildCriticMessages({
      sourceText: entry.sourceText,
      targetText: seededText,
    },),
    applications,
    plantedSeedIds: applications.map(function toId(application,) {
      return application
        .spec
        .id;
    },),
  };
}

//endregion Benchmark entry preparation
