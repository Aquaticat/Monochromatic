/**
 * Shared composer state and worker-message types.
 *
 * Extracted from `composer.ts` so the helper modules can import the
 * types without importing the entry module.
 */

import type { ChunkCache, } from '../chunk-cache.ts';
import type { Editor, } from '../editor/index.ts';
import type { Outbox, } from '../outbox.ts';
import type { StorageCaps, } from '../storage-probe.ts';

/**
 * Outbound shape from the worker so the composer can type-check messages.
 */
export type WorkerOut =
  | {
    readonly kind: 'progress';
    readonly completed: number;
    readonly total: number;
    readonly ack: number;
  }
  | {
    readonly kind: 'done';
    readonly chunkCount: number;
    readonly charCount: number;
    readonly preview: string;
    readonly chunks?: readonly {
      readonly md: string;
      readonly html: string;
      readonly charCount: number;
    }[];
  }
  | {
    readonly kind: 'metrics';
    readonly compileMs: readonly number[];
    readonly putMs: readonly number[];
    readonly maxPutQueueDepth: number;
    readonly wastedPuts: number;
  }
  | {
    readonly kind: 'error';
    readonly message: string;
  };

/**
 * Aggregated metrics surfaced to the dev overlay. Computed on the main
 * thread from the per-chunk samples the worker reports on its
 * `metrics` channel; the overlay re-renders whenever the snapshot
 * changes.
 */
export type CompilePipelineMetrics = {
  /**
   * Median compile time per chunk (ms).
   */
  compileMsMedian: number;
  /**
   * 99th-percentile compile time per chunk (ms).
   */
  compileMsP99: number;
  /**
   * Number of compile samples observed so far.
   */
  compileSamples: number;
  /**
   * Maximum observed in-flight PUT queue depth.
   */
  putQueueDepthMax: number;
  /**
   * Number of chunk renders discarded before their PUT acked.
   */
  wastedPuts: number;
  /**
   * Wall-clock time of the last tier 2 -\> 3 promotion (ms); absent before the first promotion.
   */
  transitionMs?: number;
};

/**
 * Mutable composer state.
 */
export type ComposerState = {
  // oxlint-disable-next-line eslint/no-magic-numbers -- tier discriminant
  tier: 1 | 2 | 3;
  /**
   * Compile worker; absent until the first tier-2 compile spawns it.
   */
  worker?: Worker;
  caps: StorageCaps;
  /**
   * Edit-mode message id; absent in new-message mode.
   */
  editMessageId?: number;
  /**
   * Persistent chunk-PUT outbox; built during attach and always present.
   */
  outbox: Outbox;
  /**
   * Rendered-HTML chunk cache; built during attach and always present.
   */
  cache: ChunkCache;
  /**
   * Custom editor handle; absent when the URL does not request the
   * custom editor (`?editor=custom`). When present the editor is the
   * authoritative input surface and mirrors its text into the
   * textarea on every change so the rest of the composer can keep
   * reading `textarea.value` synchronously.
   */
  editor?: Editor;
  /**
   * Live metrics aggregator used by the dev overlay. Absent when the
   * overlay is not active (no `?debug=1`); when present, the worker
   * `metrics` and the tier-3 promotion timer feed into it.
   */
  metrics?: CompilePipelineMetrics;
  /**
   * Callbacks the metrics overlay exposes to producers (the composer
   * worker and the tier-3 promotion path). Absent when the overlay
   * is not mounted; helpers should guard before invoking.
   */
  metricsHooks?: {
    onWorkerMessage: (data: unknown,) => void;
    recordTransition: (ms: number,) => void;
  };
  /**
   * Tier-3 chunk-paginated state; absent until tier-3 is reached.
   */
  tier3?: {
    /**
     * Index of the chunk currently in the editor surface.
     */
    currentSeq: number;
    /**
     * Total number of chunks for the message under edit.
     */
    chunkCount: number;
    /**
     * New draft id we PUT edited chunks into.
     */
    newDraftId: string;
    /**
     * Local copy of all chunks, populated when tier-3 was reached for
     * a new message (chunks were not yet on the server). Absent in
     * edit-mode tier 3; existing chunks resolve via the chain walk
     * on the server.
     */
    localChunks?: {
      md: string;
      html: string;
      charCount: number;
    }[];
  };
};

/**
 * Aggregated result returned by the inline / worker compile paths.
 */
export type Compiled = {
  html: string;
  chunkCount: number;
  charCount: number;
  preview: string;
  chunks: {
    md: string;
    html: string;
    charCount: number;
  }[];
};
