/**
 * Compile-pipeline metrics overlay.
 *
 * Mounted by `composer.ts` only when the URL carries `?debug=1`. The
 * overlay is a small fixed-position panel that displays the live
 * snapshot of the worker's `metrics` channel: median + p99 compile
 * time, max PUT-queue depth, wasted-PUT count, and the most recent
 * tier-2 \-\> tier-3 transition time.
 *
 * The samples come from two sources:
 *
 * - Worker `metrics` messages, emitted at the end of every compile
 *   pass. The aggregator keeps a rolling buffer of the last
 *   `SAMPLE_BUFFER` compile times so the overlay stays responsive
 *   under long sessions.
 * - The `recordTransition` helper, called from `promoteToTier3`
 *   immediately after the buffer flush.
 */

import {
  median,
  percentile,
  PERCENTILE_99,
} from './metrics-stats.ts';
import type {
  CompilePipelineMetrics,
  ComposerState,
} from './state.ts';

/**
 * Maximum number of compile samples to retain in the rolling buffer.
 */
const SAMPLE_BUFFER = 200;

/**
 * Empty metrics snapshot used to seed `state.metrics` when the
 * overlay mounts.
 *
 * @returns fresh zeroed snapshot
 */
function emptyMetrics(): CompilePipelineMetrics {
  return {
    compileMsMedian: 0,
    compileMsP99: 0,
    compileSamples: 0,
    putQueueDepthMax: 0,
    wastedPuts: 0,
  };
}

/**
 * Renders one row of the overlay as an HTML fragment.
 *
 * @param input - label shown on the left and value shown on the right
 *
 * @returns innerHTML fragment
 *
 * @example
 * ```ts
 * row({ label: 'compile p50', value: '12.4 ms' });
 * // -> '<div class="composer-metrics-row"><span>compile p50</span><span>12.4 ms</span></div>'
 * ```
 */
function row(
  input: {
    readonly label: string;
    readonly value: string;
  },
): string {
  return `<div class="composer-metrics-row"><span>${input.label}</span><span>${input.value}</span></div>`;
}

/**
 * Builds the overlay DOM and returns a function that re-renders it
 * from the latest `state.metrics` snapshot.
 *
 * @param input - parent element to mount under and shared state
 *
 * @returns render callback
 *
 * @example
 * ```ts
 * const render = mountMetricsOverlay({ parent: document.body, state });
 * ```
 */
function mountMetricsOverlay(
  input: {
    parent: HTMLElement;
    state: ComposerState;
  },
): () => void {
  /**
   * Overlay container appended to the parent; re-rendered on every metrics update.
   */
  const overlay = document.createElement('div',);
  overlay.className = 'composer-metrics-overlay';
  overlay.dataset
    .testid = 'metrics-overlay';
  input.parent
    .append(overlay,);
  return function render(): void {
    /**
     * Snapshot of state metrics, falling back to empty when not yet seeded.
     */
    const m = input.state
      .metrics
      ?? emptyMetrics();
    overlay.innerHTML = `${
      row({
        label: 'compile p50',
        value: `${m.compileMsMedian
          .toFixed(1,)} ms`,
      },)
    }${
      row({
        label: 'compile p99',
        value: `${m.compileMsP99
          .toFixed(1,)} ms`,
      },)
    }${
      row({
        label: 'samples',
        value: String(m.compileSamples,),
      },)
    }${
      row({
        label: 'put queue max',
        value: String(m.putQueueDepthMax,),
      },)
    }${
      row({
        label: 'wasted puts',
        value: String(m.wastedPuts,),
      },)
    }${
      row({
        label: 'transition',
        value: m.transitionMs
          === undefined
          ? 'n/a'
          : `${m.transitionMs
            .toFixed(1,)} ms`,
      },)
    }`;
  };
}

/**
 * Folded shape of the worker `metrics` payload after type narrowing.
 */
type WorkerMetricsPayload = {
  compileMs?: readonly unknown[];
  maxPutQueueDepth?: unknown;
  wastedPuts?: unknown;
};

/**
 * Sentinel returned by `asMetricsPayload` when the inbound message is
 * not a worker `metrics` payload. A unique `Symbol` rather than `null`:
 * a real payload is always an object, so callers gate with `=== NOT_METRICS`.
 */
const NOT_METRICS: unique symbol = Symbol('messages-demo:not-metrics',);

/**
 * Narrows `data` to a worker `metrics` payload, returning `NOT_METRICS`
 * when the shape does not match.
 *
 * @param data - inbound message data
 *
 * @returns the payload, or `NOT_METRICS` when unrelated
 */
function asMetricsPayload(data: unknown,): WorkerMetricsPayload | typeof NOT_METRICS {
  if (((typeof data) !== 'object') || (data === null)
    || (!('kind' in data)))
    return NOT_METRICS;
  /**
   * Narrowed alias so the `kind` check reads `message.kind` rather than a type-cast.
   */
  const message: { kind: unknown; } = data;
  if (message.kind
    !== 'metrics')
    return NOT_METRICS;
  // Narrow to the optional-fields shape; the worker emits a stricter
  // type, but we accept anything structurally compatible.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- structural narrowing
  return data as WorkerMetricsPayload;
}

/**
 * Folds payload counts (queue depth max, wasted puts) into the
 * snapshot. Compile-time samples are buffered separately by the
 * caller.
 *
 * @param input - current snapshot + payload
 *
 * @returns next snapshot
 */
function foldCounters(
  input: {
    readonly current: Readonly<CompilePipelineMetrics>;
    readonly payload: Readonly<WorkerMetricsPayload>;
  },
): CompilePipelineMetrics {
  /**
   * Running snapshot; replaced with widened copies as each payload field folds in.
   */
  let next = input.current;
  if ((typeof input.payload
    .maxPutQueueDepth) === 'number') {
    next = {
      ...next,
      putQueueDepthMax: Math.max(
        next.putQueueDepthMax,
        input.payload
          .maxPutQueueDepth,
      ),
    };
  }
  if ((typeof input.payload
    .wastedPuts) === 'number') {
    next = {
      ...next,
      wastedPuts: next.wastedPuts
        + input
        .payload
        .wastedPuts,
    };
  }
  return next;
}

/**
 * Attaches the metrics overlay and seeds `state.metrics`. Returns
 * helpers the composer holds onto for the worker / promotion sites
 * to call into.
 *
 * @param input - parent element and shared state
 *
 * @returns helpers to feed worker metrics and transition timings
 *
 * @example
 * ```ts
 * const overlay = attachMetricsOverlay({ parent: document.body, state });
 * worker.addEventListener('message', e => overlay.onWorkerMessage(e.data));
 * ```
 */
export function attachMetricsOverlay(
  input: {
    parent: HTMLElement;
    state: ComposerState;
  },
): {
  /**
   * Folds a worker `metrics` message into the rolling sample buffer
   * and re-renders. Other message kinds are ignored.
   */
  onWorkerMessage: (data: unknown,) => void;
  /**
   * Records one tier 2 -\> 3 transition wall-clock time.
   */
  recordTransition: (ms: number,) => void;
} {
  input.state
    .metrics = emptyMetrics();
  /**
   * Rolling buffer of per-chunk compile times; folded into the median/p99 stats.
   */
  const samples: number[] = [];
  /**
   * Imperative re-render callback; called after every fold.
   */
  const render = mountMetricsOverlay({
    parent: input.parent,
    state: input.state,
  },);
  render();

  /**
   * Recomputes derived stats from the rolling buffer and re-renders.
   */
  function refresh(): void {
    if (input.state
      .metrics
      === undefined)
      return;
    /**
     * Ascending copy of `samples`; fed to median/percentile helpers.
     */
    const sorted = samples.toSorted(function asc(
      a,
      b,
    ) {
      return a - b;
    },);
    input.state
      .metrics = {
      ...input.state
        .metrics,
      compileMsMedian: median(sorted,),
      compileMsP99: percentile({
        sortedAsc: sorted,
        p: PERCENTILE_99,
      },),
      compileSamples: samples.length,
    };
    render();
  }

  return {
    onWorkerMessage(data,) {
      /**
       * Narrowed worker metrics payload; `NOT_METRICS` skips non-metrics messages.
       */
      const payload = asMetricsPayload(data,);
      if (payload === NOT_METRICS)
        return;
      if (Array.isArray(payload.compileMs,)) {
        for (const sample of payload.compileMs) {
          if ((typeof sample) !== 'number')
            continue;
          samples.push(sample,);
          if (samples.length
            > SAMPLE_BUFFER)
            samples.shift();
        }
      }
      if (input.state
        .metrics
        !== undefined) {
        input.state
          .metrics = foldCounters({
          current: input.state
            .metrics,
          payload,
        },);
      }
      refresh();
    },
    recordTransition(ms,) {
      if (input.state
        .metrics
        === undefined)
        return;
      input.state
        .metrics = {
        ...input.state
          .metrics,
        transitionMs: ms,
      };
      render();
    },
  };
}
