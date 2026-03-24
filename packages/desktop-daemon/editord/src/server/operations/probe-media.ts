/**
 * Runs `ffprobe` on a media file and returns the trimmed metadata output.
 *
 * Strips the initial header (version, build config, library versions) and
 * returns only the input/stream information. Returns `null` when `ffprobe`
 * is not installed or exits with an error that produces no useful output.
 */

import spawn from 'nano-spawn';

import {
  l,
  tagged,
} from '../log.ts';

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

/** Probe timeout in milliseconds. */
const TIMEOUT_MS = 5_000;

/**
 * Extracts the metadata portion of ffprobe output starting from the
 * first `Input #` line.
 *
 * @param stderr - raw ffprobe stderr output
 *
 * @param path - file path for logging
 *
 * @returns trimmed metadata, or `null` if no `Input #` line found
 */
function extractMetadata(
  { stderr, path, }: { stderr: string; path: string; },
): string | null {
  if (stderr === '') {
    probeLog.info(`no output for: ${path}`,);
    return null;
  }

  const match = INPUT_LINE_PATTERN.exec(stderr,);
  if (match === null) {
    probeLog.info(`no Input line found for: ${path}`,);
    return null;
  }

  const trimmed = stderr.slice(match.index,).trimEnd();
  probeLog.info(`probed: ${path}`,);
  return trimmed;
}

/**
 * Probes a media file with `ffprobe` and returns the metadata portion
 * of the output (from the first `Input #` line onward).
 *
 * @param path - absolute path to the media file
 *
 * @returns trimmed ffprobe output starting from `Input #`, or `null` on failure
 */
export async function probeMedia({ path, }: { path: string; },): Promise<string | null> {
  try {
    /** ffprobe writes metadata to stderr even on success. */
    const result = await spawn('ffprobe', [path,], { timeout: TIMEOUT_MS, },);
    return extractMetadata({ stderr: result.stderr, path, },);
  }
  catch (error) {
    /**
     * ffprobe often exits non-zero (e.g. for image files).
     * nano-spawn's SubprocessError still carries the captured stderr.
     */
    if (error !== null && typeof error === 'object' && 'stderr' in error) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'stderr' in check
      const { stderr, } = error as { stderr: string; };
      return extractMetadata({ stderr, path, },);
    }

    probeLog.info(`ffprobe failed for: ${path}`,);
    return null;
  }
}
