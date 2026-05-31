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

/**
 * Tagged logger for media probing.
 */
const probeLog = tagged({
  tag: 'probe-media',
  l,
},);

/**
 * Literal prefix marking the start of the useful ffprobe output line.
 * Everything before this on a line of its own is version/build noise.
 *
 * @example
 * ```
 * Input #0, png_pipe, from '/path/to/file.png':
 * ```
 */
const INPUT_LINE_PREFIX = 'Input #';

/**
 * Finds the start offset of the first line in `text` that begins with
 * `INPUT_LINE_PREFIX`.
 *
 * @param text - ffprobe stderr output
 *
 * @returns line-start offset, or -1 when no matching line exists
 */
function findInputLineStart(text: string,): number {
  if (text.startsWith(INPUT_LINE_PREFIX,))
    return 0;
  /**
   * Index of the matched prefix when it lives on a non-first line; -1 means none.
   */
  const idx = text.indexOf(`\n${INPUT_LINE_PREFIX}`,);
  if (idx === (-1))
    return -1;
  return idx + 1;
}

/**
 * Probe timeout in milliseconds.
 */
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
  {
    stderr,
    path,
  }: {
    readonly stderr: string;
    readonly path: string;
  },
): string | null {
  if (stderr === '') {
    probeLog.info(`no output for: ${path}`,);
    return null;
  }

  /**
   * Anchor in stderr at which the useful `Input #...` metadata begins; -1 means none.
   */
  const startIdx = findInputLineStart(stderr,);
  if (startIdx === (-1)) {
    probeLog.info(`no Input line found for: ${path}`,);
    return null;
  }

  /**
   * Metadata-only slice, trailing whitespace removed for tidy display.
   */
  const trimmed = stderr.slice(startIdx,)
    .trimEnd();
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
 *
 * @example
 * ```ts
 * const result = await probeMedia({ path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function probeMedia({ path, }: { readonly path: string; },): Promise<string | null> {
  try {
    /**
     * ffprobe writes metadata to stderr even on success.
     */
    const result = await spawn(
      'ffprobe',
      [path,],
      { timeout: TIMEOUT_MS, },
    );
    return extractMetadata({
      stderr: result.stderr,
      path,
    },);
  }
  catch (error) {
    /**
     * ffprobe often exits non-zero (e.g. for image files).
     * nano-spawn's SubprocessError still carries the captured stderr.
     */
    if ((error !== null) && ((typeof error) === 'object')
      && ('stderr' in error)) {
      /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- narrowed by 'stderr' in check */
      /**
       * Stderr captured by nano-spawn on non-zero exit; still contains the metadata we want.
       */
      const { stderr, } = error as { readonly stderr: string; };
      /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
      return extractMetadata({
        stderr,
        path,
      },);
    }

    probeLog.info(`ffprobe failed for: ${path}`,);
    return null;
  }
}
