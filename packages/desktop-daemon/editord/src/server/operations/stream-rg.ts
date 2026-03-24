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
 */
export function streamRg({ args, maxResults, processLine, signal, }: {
  args: readonly string[];
  maxResults: number;
  processLine: (line: string,) => SearchResult | null;
  signal: AbortSignal | undefined;
},): Promise<SearchResult[]> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping streaming child process events into a promise requires new Promise
  return new Promise<SearchResult[]>(function awaitRg(resolve, reject,) {
    const proc = spawn('rg', ['--line-buffered', ...args,],);
    const results: SearchResult[] = [];
    let buffer = '';
    let resolved = false;

    /**
     * Resolves the promise and kills the child process.
     * Guards against double-resolution from concurrent close/data events.
     */
    function finish(): void {
      if (resolved)
        return;

      resolved = true;
      proc.kill();
      resolve(results,);
    }

    if (signal !== undefined)
      signal.addEventListener('abort', finish, { once: true, },);

    proc.stdout.on('data', function handleData(chunk: Buffer,) {
      buffer += chunk.toString('utf8',);
      const lines = buffer.split('\n',);
      /** Keep the last (possibly incomplete) line in the buffer. */
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line === '')
          continue;

        const result = processLine(line,);
        if (result !== null) {
          results.push(result,);
          if (results.length >= maxResults) {
            finish();
            return;
          }
        }
      }
    },);

    proc.on('close', function handleClose() {
      if (buffer !== '') {
        const result = processLine(buffer,);
        if (result !== null)
          results.push(result,);
      }

      finish();
    },);

    proc.on('error', function handleError(error,) {
      if (!resolved) {
        resolved = true;
        reject(error,);
      }
    },);
  },);
}
