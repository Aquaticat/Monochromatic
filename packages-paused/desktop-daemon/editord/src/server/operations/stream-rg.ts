/**
 * Streaming ripgrep subprocess helper.
 *
 * Spawns `rg` and processes stdout line-by-line via a callback.
 * Kills the child process early once enough results are collected
 * or when an `AbortSignal` fires. Uses `--line-buffered` so lines
 * arrive promptly instead of accumulating in block-sized chunks.
 */

import { spawn, } from 'node:child_process';

import type { SearchResult, } from '../../protocol.ts';

/**
 * Spawns `rg` and processes stdout line-by-line via a callback.
 * Kills the child process once `maxResults` results are collected,
 * or when the `signal` is aborted.
 *
 * @param args - arguments to pass to `rg` (after the implicit `--line-buffered`)
 *
 * @param maxResults - stop after collecting this many results
 *
 * @param processLine - callback that converts a stdout line to a result, or null to skip
 *
 * @param signal - optional abort signal for cancellation
 *
 * @returns collected search results
 *
 * @throws when `rg` cannot be spawned
 *
 * @example
 * ```ts
 * const results = await streamRg({
 *   args: ['--json', 'TODO', 'src/'],
 *   maxResults: 100,
 *   processLine: function parseLine(line) { return JSON.parse(line); },
 *   signal: controller.signal,
 * });
 * ```
 */
export function streamRg({
  args,
  maxResults,
  processLine,
  signal,
}: {
  readonly args: readonly string[];
  readonly maxResults: number;
  readonly processLine: (line: string,) => SearchResult | null;
  readonly signal: AbortSignal | undefined;
},): Promise<SearchResult[]> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping streaming child process events into a promise requires new Promise
  return new Promise<SearchResult[]>(function awaitRg(
    resolve,
    reject,
  ) {
    /**
     * Child process whose stdout is parsed line-by-line below.
     */
    const proc = spawn(
      'rg',
      [
        '--line-buffered',
        ...args,
      ],
    );
    /**
     * Accumulator passed to `resolve` once the process closes or the cap is hit.
     */
    const results: SearchResult[] = [];
    /**
     * Closure-shared state for the data/close/error handlers below.
     *
     * - `buffer`: partial last line carried between data events.
     * - `resolved`: idempotency guard so close/data races resolve the promise only once.
     *
     * Held in an object so the inner handlers can mutate the same fields without
     * a function-root `let`.
     */
    const state = {
      buffer: '',
      resolved: false,
    };

    /**
     * Resolves the promise and kills the child process.
     * Guards against double-resolution from concurrent close/data events.
     */
    function finish(): void {
      if (state.resolved)
        return;

      state.resolved = true;
      proc.kill();
      resolve(results,);
    }

    if (signal !== undefined) {
      signal.addEventListener(
        'abort',
        finish,
        { once: true, },
      );
    }

    proc.stdout
      .on(
      'data',
      function handleData(chunk: Buffer,) {
        state.buffer += chunk.toString('utf8',);
        /**
         * Split on newlines; the trailing partial line stays in `state.buffer`.
         */
        const lines = state.buffer
          .split('\n',);
        /**
         * Keep the last (possibly incomplete) line in the buffer.
         */
        state.buffer = lines.pop()
          ?? '';

        for (const line of lines) {
          if (line === '')
            continue;

          /**
           * Null skips noise lines (rg JSON envelopes that are not match records).
           */
          const result = processLine(line,);
          if (result !== null) {
            results.push(result,);
            if (results.length
              >= maxResults) {
              finish();
              return;
            }
          }
        }
      },
    );

    proc.on(
      'close',
      function handleClose() {
        if (state.buffer
          !== '') {
          /**
           * Last partial line salvaged on close so we do not drop the final hit.
           */
          const result = processLine(state.buffer,);
          if (result !== null)
            results.push(result,);
        }

        finish();
      },
    );

    proc.on(
      'error',
      function handleError(error,) {
        if (!state.resolved) {
          state.resolved = true;
          reject(error,);
        }
      },
    );
  },);
}
