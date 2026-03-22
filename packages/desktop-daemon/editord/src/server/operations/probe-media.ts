/**
 * Runs `ffprobe` on a media file and returns the trimmed metadata output.
 *
 * Strips the initial header (version, build config, library versions) and
 * returns only the input/stream information. Returns `null` when `ffprobe`
 * is not installed or exits with an error.
 */

import { execFile, } from 'node:child_process';

import { l, tagged, } from '../log.ts';

/** Tagged logger for media probing. */
const probeLog = tagged({ tag: 'probe-media', l, },);

/**
 * Regex matching the start of the useful ffprobe output.
 * Everything before the first `Input #` line is version/build noise.
 *
 * @example
 * ```
 * Input #0, png_pipe, from '/path/to/file.png':
 * ```
 */
const INPUT_LINE_PATTERN = /^Input #/m;

/**
 * Probes a media file with `ffprobe` and returns the metadata portion
 * of the output (from the first `Input #` line onward).
 *
 * @param path - absolute path to the media file
 *
 * @returns trimmed ffprobe output starting from `Input #`, or `null` on failure
 */
export function probeMedia({ path, }: { path: string }): Promise<string | null> {
  return new Promise(function runProbe(resolve,) {
    execFile('ffprobe', [path,], { timeout: 5_000, }, function handleResult(_error, _stdout, stderr,) {
      /**
       * ffprobe writes metadata to stderr by default.
       * Any failure (missing binary, bad file, timeout) resolves to `null`.
       */
      if (stderr === '') {
        probeLog.info(`no output for: ${path}`,);
        resolve(null,);
        return;
      }

      const match = INPUT_LINE_PATTERN.exec(stderr,);
      if (match === null || match.index === undefined) {
        probeLog.info(`no Input line found for: ${path}`,);
        resolve(null,);
        return;
      }

      const trimmed = stderr.slice(match.index,).trimEnd();
      probeLog.info(`probed: ${path}`,);
      resolve(trimmed,);
    },);
  });
}
