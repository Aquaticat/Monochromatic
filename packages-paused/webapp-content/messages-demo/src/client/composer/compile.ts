/**
 * Markdown -> HTML compile paths.
 *
 * Two implementations:
 *
 * - `compileInline` runs `micromark` on the main thread. Used by tier-1
 *   sends and the tier-3 single-chunk save path.
 * - `compileViaWorker` lazily spawns the composer worker and asks it to
 *   compile the body. Used by tier 2.
 */

import {
  extractPreview,
  renderChunks,
} from '../../lib/markdown-stream.ts';
import type {
  Compiled,
  ComposerState,
  WorkerOut,
} from './state.ts';

/**
 * Maximum length of the message preview, in characters.
 */
const PREVIEW_MAX_LENGTH = 200;


/**
 * Compiles markdown to HTML on the main thread. Used by tier-1 and
 * tier-3 single-chunk paths where we know the input is small enough to
 * compile without the worker.
 *
 * @param body - markdown source
 *
 * @returns compiled aggregates
 *
 * @example
 * ```ts
 * const compiled = compileInline('# hi');
 * ```
 */
export function compileInline(body: string,): Compiled {
  /**
   * Per-chunk rendered output; returned on the `chunks` field so the caller can PUT each row.
   */
  const chunks = [...renderChunks(body,),].map(function copy(chunk,) {
    return {
      md: chunk.md,
      html: chunk.html,
      charCount: chunk.charCount,
    };
  },);
  /**
   * First chunk's markdown captured once for the preview field.
   */
  const firstMd = chunks[0]
    ?.md
    ?? '';
  /**
   * Accumulated character count across all chunks; passed to finalize.
   */
  const charCount = chunks.reduce(
    function sumCharCount(
      acc,
      chunk,
    ) {
      return acc + chunk
        .charCount;
    },
    0,
  );
  /**
   * Concatenated HTML; tier-1 sends inspect this for empty-result fallbacks.
   */
  const html = chunks
    .map(function pickHtml(chunk,) {
      return chunk.html;
    },)
    .join('',);
  return {
    html,
    chunkCount: chunks.length,
    charCount,
    preview: extractPreview({
      md: firstMd,
      maxLength: PREVIEW_MAX_LENGTH,
    },),
    chunks,
  };
}

/**
 * Spawns (lazily) the composer worker and asks it to compile the body
 * locally without uploading. The composer then PUTs each chunk itself
 * using the data the worker returned. Used by tier 2.
 *
 * @param input - body and shared composer state
 *
 * @returns compiled aggregates returned by the worker
 *
 * @example
 * ```ts
 * const compiled = await compileViaWorker({ body, state });
 * ```
 */
export function compileViaWorker(
  input: {
    body: string;
    state: ComposerState;
  },
): Promise<Compiled> {
  // The worker uses a postMessage event-callback API; the Promise
  // constructor is the only reasonable bridge to async/await.
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges callback API
  return new Promise(function executor(
    resolve,
    reject,
  ) {
    input.state
      .worker ??= new Worker(
      new URL(
        'composer.worker.js',
        import.meta.url,
      ),
      { type: 'module', },
    );
    /**
     * Non-null after the lazy-create above; destructured so the listener wiring reads it directly.
     */
    const { worker, } = input.state;
    // Pipe every worker message through the metrics hooks (when the
    // overlay is mounted). The hook discriminates on `kind` and only
    // folds `metrics` payloads, so non-metrics messages are no-ops.
    /**
     * Optional metrics hook; present causes the tee listener to fold metrics envelopes.
     */
    const { metricsHooks, } = input.state;
    if (metricsHooks !== undefined) {
      worker.addEventListener(
        'message',
        function tee(event: MessageEvent<unknown>,): void {
          metricsHooks.onWorkerMessage(event.data,);
        },
      );
    }
    /**
     * Routes worker messages: resolve on `done`, reject on `error`,
     * detach the listener after either terminal event.
     *
     * @param event - worker message event
     *
     * @example
     * ```ts
     * worker.addEventListener('message', onMessage);
     * ```
     */
    function onMessage(event: MessageEvent<WorkerOut>,): void {
      /**
       * Destructured early so the kind switch reads `data.kind` without repeated access.
       */
      const { data, } = event;
      if (data.kind
        === 'done') {
        worker.removeEventListener(
          'message',
          onMessage,
        );
        resolve({
          html: '',
          chunkCount: data.chunkCount,
          charCount: data.charCount,
          preview: data.preview,
          chunks: data.chunks
            ?.map(function copy(chunk,) {
            return {
              md: chunk.md,
              html: chunk.html,
              charCount: chunk.charCount,
            };
          },)
            ?? [],
        },);
      }
      else if (data.kind
        === 'error') {
        worker.removeEventListener(
          'message',
          onMessage,
        );
        reject(new Error(data.message,),);
      }
    }
    worker.addEventListener(
      'message',
      onMessage,
    );
    // Worker.postMessage does not accept targetOrigin (only Window does);
    // the rule fires on every postMessage call regardless.
    /* oxlint-disable eslint-plugin-unicorn/require-post-message-target-origin -- Worker channel */
    worker.postMessage({
      kind: 'compile-only',
      body: input.body,
    },);
    /* oxlint-enable eslint-plugin-unicorn/require-post-message-target-origin */
  },);
}
