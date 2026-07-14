/**
 * Composer Web Worker.
 *
 * Receives the full markdown body from the main thread, runs the
 * block-boundary chunker (shared with the server via
 * `lib/markdown-stream.ts`), and PUTs each chunk to the server. Reports
 * progress back to the main thread so the composer can show "saving..."
 * and finalise on completion.
 *
 * Two message kinds in:
 *   { kind: 'compile-and-upload', draftId, body }
 *   { kind: 'compile-only', body }
 *
 * Two message kinds out:
 *   { kind: 'progress', completed, total, ack }
 *   { kind: 'done', chunkCount, charCount, preview }
 *   { kind: 'error', message }
 */

import {
  extractPreview,
  renderChunks,
} from '../lib/markdown-stream.ts';

/**
 * Maximum length of the preview snippet, in characters.
 */
const PREVIEW_MAX_LENGTH = 200;

/**
 * Maximum number of PUT retries per chunk.
 */
const PUT_MAX_ATTEMPTS = 3;

/**
 * Initial backoff delay between PUT retries, in milliseconds.
 */
const PUT_BACKOFF_BASE_MS = 250;

/**
 * Inbound message from the composer.
 */
type InboundMessage =
  | {
    readonly kind: 'compile-and-upload';
    readonly draftId: string;
    readonly body: string;
  }
  | {
    readonly kind: 'compile-only';
    readonly body: string;
  };

/**
 * Outbound message back to the composer.
 */
type OutboundMessage =
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
    /**
     * Time in ms to render each chunk's HTML (one entry per chunk).
     */
    readonly compileMs: readonly number[];
    /**
     * Time in ms each chunk spent PUT-pending (zero in compile-only).
     */
    readonly putMs: readonly number[];
    /**
     * Maximum observed depth of the in-flight PUT queue this session.
     */
    readonly maxPutQueueDepth: number;
    /**
     * Number of chunk renders discarded before their PUT acked.
     */
    readonly wastedPuts: number;
  }
  | {
    readonly kind: 'error';
    readonly message: string;
  };

/**
 * Main worker dispatch. Discriminates on `kind` and runs the requested
 * pipeline. Errors are caught and sent back as `{ kind: 'error' }`.
 */
/**
 * Worker message dispatch. Routes inbound messages and surfaces async
 * errors via the outbound `error` channel.
 *
 * @param event - inbound `message` event
 *
 * @example
 * ```ts
 * self.addEventListener('message', function (e) { void onMessage(e); });
 * ```
 */
async function onMessage(event: MessageEvent<InboundMessage>,): Promise<void> {
  /**
   * Destructured early so the kind switch can read it without repeated `event.data` access.
   */
  const { data, } = event;
  try {
    if (data.kind
      === 'compile-and-upload')
      await runCompileAndUpload(data,);
    else if (data.kind
      === 'compile-only')
      runCompileOnly(data,);
  }
  catch (error) {
    /**
     * Default text overwritten when the caught value has a usable message; sent as the error envelope.
     */
    let message = 'unknown worker error';
    if (error instanceof Error)
      ({ message, } = error);
    else if ((typeof error) === 'string')
      message = error;
    post({
      kind: 'error',
      message,
    },);
  }
}

self.addEventListener(
  'message',
  function dispatch(event,): void {
    // The DOM lib types `event` as `MessageEvent<any>`; we contract a
    // narrower payload via `InboundMessage`.
    // oxlint-disable-next-line typescript/no-unsafe-argument -- typed channel
    void onMessage(event,);
  },
);

/**
 * Compile every chunk locally without uploading. Used by tier 1/2 when
 * the composer wants the rendered chunks back as a single batch (e.g.
 * to PUT them all on send).
 *
 * @param input - body to compile
 */
function runCompileOnly(input: { body: string; },): void {
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- streaming compile pipeline: `charCount` sums per-chunk char counts; `firstMd` captures the chunk-0 markdown exactly once; `lastTick` is the previous-boundary timestamp subtracted on every iteration to bill per-chunk compile cost */
  /**
   * Aggregated rendered chunks, sent on the `done` envelope so the main thread can PUT them in one batch.
   */
  const collected: {
    md: string;
    html: string;
    charCount: number;
  }[] = [];
  /**
   * Per-chunk compile durations; sent on the `metrics` envelope for the overlay.
   */
  const compileMs: number[] = [];
  /**
   * Running sum of char counts; sent on the `done` envelope as the message's total length.
   */
  let charCount = 0;
  /**
   * First chunk's markdown, captured once so the preview can be extracted after the loop.
   */
  let firstMd = '';
  // renderChunks is a lazy generator: each iteration runs the chunker
  // up to the next block boundary and calls micromark on the block.
  // Timing each iteration captures the per-chunk compile cost.
  /**
   * Tick of the previous boundary; subtracted from `now` to bill per-chunk compile time.
   */
  let lastTick = performance.now();
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  for (const chunk of renderChunks(input.body,)) {
    /**
     * Tick at the start of this iteration; replaces `lastTick` once the duration is recorded.
     */
    const now = performance.now();
    compileMs.push(now - lastTick,);
    lastTick = now;
    if (collected.length
      === 0)
      firstMd = chunk.md;
    collected.push({
      md: chunk.md,
      html: chunk.html,
      charCount: chunk.charCount,
    },);
    charCount += chunk.charCount;
  }
  post({
    kind: 'metrics',
    compileMs,
    putMs: [],
    maxPutQueueDepth: 0,
    wastedPuts: 0,
  },);
  post({
    kind: 'done',
    chunkCount: collected.length,
    charCount,
    preview: extractPreview({
      md: firstMd,
      maxLength: PREVIEW_MAX_LENGTH,
    },),
    chunks: collected,
  },);
}

/**
 * Compile + PUT each chunk in order. Reports progress between PUTs and
 * sends `done` once finalize-ready aggregates are known.
 *
 * @param input - draft id + full body
 */
async function runCompileAndUpload(
  input: {
    draftId: string;
    body: string;
  },
): Promise<void> {
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- streaming PUT pipeline: `seq`/`charCount`/`firstMd` accumulate across the PUT loop and feed the final `done` envelope; `maxPutQueueDepth`/`pendingPuts` form the in-flight-depth high-watermark recorded in metrics; `chunkTick` is the rolling boundary used to bill per-block compile time */
  /**
   * Monotonic chunk index used as the PUT seq path segment and progress envelope value.
   */
  let seq = 0;
  /**
   * Running sum of char counts; sent on the `done` envelope as the message's total length.
   */
  let charCount = 0;
  /**
   * First chunk's markdown, captured once so the preview can be extracted after the loop.
   */
  let firstMd = '';
  /**
   * Buffer of every PUT'd chunk; sent on the `done` envelope so the main thread can adopt them.
   */
  const allChunks: {
    md: string;
    html: string;
    charCount: number;
  }[] = [];
  /**
   * Per-chunk compile durations recorded inside the chunker loop.
   */
  const compileMs: number[] = [];
  /**
   * Per-chunk PUT durations recorded around each network call.
   */
  const putMs: number[] = [];
  /**
   * Max observed in-flight PUT depth this session; sent on the `metrics` envelope.
   */
  let maxPutQueueDepth = 0;
  /**
   * In-flight PUT counter; incremented before each PUT and decremented after ack.
   */
  let pendingPuts = 0;
  // Time the chunker: the iteration cost includes the per-block
  // micromark compile, which is what we want to measure.
  /**
   * Tick of the previous chunker boundary; subtracted from `now` to bill compile time.
   */
  let chunkTick = performance.now();
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  /**
   * Pre-PUT staging: chunker fully drains here before any PUT starts so progress totals are exact.
   */
  const chunks: {
    md: string;
    html: string;
    charCount: number;
  }[] = [];
  for (const chunk of renderChunks(input.body,)) {
    /**
     * Tick at the start of this chunker iteration; replaces `chunkTick` after billing.
     */
    const now = performance.now();
    compileMs.push(now - chunkTick,);
    chunkTick = now;
    chunks.push({
      md: chunk.md,
      html: chunk.html,
      charCount: chunk.charCount,
    },);
  }
  // Sequential PUTs let the server return ack-up-to-N for the outbox to
  // drop acknowledged entries; parallel uploads would race the ack.
  /* oxlint-disable eslint/no-await-in-loop -- sequential PUTs are required so the server can return ack-up-to-N; parallelising them races the ack */
  for (const chunk of chunks) {
    if (seq === 0)
      firstMd = chunk.md;
    pendingPuts += 1;
    maxPutQueueDepth = Math.max(
      maxPutQueueDepth,
      pendingPuts,
    );
    /**
     * Tick at PUT start; subtracted from the post-await tick to record PUT duration.
     */
    const putStart = performance.now();
    /**
     * Highest contiguous seq the server acknowledges; forwarded via the `progress` envelope.
     */
    const ack = await putOneChunk({
      draftId: input.draftId,
      seq,
      chunk: {
        md: chunk.md,
        html: chunk.html,
        charCount: chunk.charCount,
      },
    },);
    putMs.push(performance.now()
      - putStart,);
    pendingPuts -= 1;
    allChunks.push({
      md: chunk.md,
      html: chunk.html,
      charCount: chunk.charCount,
    },);
    charCount += chunk.charCount;
    seq += 1;
    post({
      kind: 'progress',
      completed: seq,
      total: chunks.length,
      ack,
    },);
  }
  /* oxlint-enable eslint/no-await-in-loop */
  post({
    kind: 'metrics',
    compileMs,
    putMs,
    maxPutQueueDepth,
    // The current pipeline does not recompile any chunk before its PUT
    // acks; wastedPuts is structurally zero here. Kept on the channel so
    // the overlay can render the field consistently.
    wastedPuts: 0,
  },);
  post({
    kind: 'done',
    chunkCount: chunks.length,
    charCount,
    preview: extractPreview({
      md: firstMd,
      maxLength: PREVIEW_MAX_LENGTH,
    },),
    chunks: allChunks,
  },);
}

/**
 * PUTs one chunk. Retries up to three times on network failure with
 * exponential backoff (250 ms, 500 ms, 1 s). Throws after the third
 * failure so the worker dispatch can surface an error to the composer.
 *
 * @param input - chunk identifiers and content
 *
 * @returns `ack` returned by the server (highest contiguous seq)
 */
async function putOneChunk(
  input: {
    draftId: string;
    seq: number;
    chunk: {
      md: string;
      html: string;
      charCount: number;
    };
  },
): Promise<number> {
  /**
   * Stable URL captured once so every retry attempt targets the same chunk slot.
   */
  const url = `/api/drafts/${encodeURIComponent(input.draftId,)}/chunks/${
    String(input.seq,)
  }`;
  /**
   * JSON body serialised once outside the retry loop to avoid repeated stringify cost.
   */
  const body = JSON.stringify({
    md: input.chunk
      .md,
    html: input.chunk
      .html,
    char_count: input.chunk
      .charCount,
  },);
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- retry-loop error capture: the catch arm assigns the latest failure and the post-loop throw rethrows it; replacing with a try-catch-around-each-attempt loses the bounded-retry shape */
  /**
   * Holds the most recent failure so the post-loop throw can rethrow it.
   */
  let lastError: unknown = undefined;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  // Retry loop with exponential backoff: each attempt depends on the
  // previous one failing, so it is inherently sequential.
  /* oxlint-disable eslint/no-await-in-loop */
  for (let attempt = 0; attempt < PUT_MAX_ATTEMPTS; attempt += 1) {
    try {
      /**
       * Awaited so both the status check and the JSON read can reuse the same response.
       */
      const response = await fetch(
        url,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', },
          body,
        },
      );
      if (!response.ok) {
        throw new Error(
          `PUT chunk ${String(input.seq,)} returned ${String(response.status,)}`,
        );
      }
      /* oxlint-disable typescript/no-unsafe-type-assertion -- json is unknown */
      /**
       * Server ack envelope; the `ack` field falls back to `input.seq` when missing or non-numeric.
       */
      const parsed = await response.json() as { ack?: unknown; };
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      return (typeof parsed.ack) === 'number' ? parsed.ack : input.seq;
    }
    catch (error) {
      lastError = error;
      /**
       * Exponential backoff per retry; doubles on each attempt (250 ms, 500 ms, 1 s).
       */
      const delay = PUT_BACKOFF_BASE_MS * (1 << attempt);
      // setTimeout is callback-based; the Promise constructor is the only
      // way to await the delay.
      // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges callback API
      await new Promise<void>(function wait(resolve,) {
        setTimeout(
          resolve,
          delay,
        );
      },);
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
  throw lastError instanceof Error
    ? lastError
    : new Error('chunk PUT failed after retries',);
}

/**
 * Type-safe `postMessage` to the main thread.
 *
 * @param message - outbound payload
 */
function post(message: OutboundMessage,): void {
  // DedicatedWorkerGlobalScope.postMessage has no targetOrigin parameter.
  /* oxlint-disable eslint-plugin-unicorn/require-post-message-target-origin -- Worker channel */
  self.postMessage(message,);
  /* oxlint-enable eslint-plugin-unicorn/require-post-message-target-origin */
}
