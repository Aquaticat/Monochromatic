/**
 * Post-processing for the SSG build.
 *
 * Compresses output with zstd.
 */
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import spawn from 'nano-spawn';

import type { Logger, } from '../lib/types.ts';
import { DIST, } from './write-page.ts';

/**
 * Compresses generated files with zstd.
 *
 * Zstd compression failure is non-fatal: builds succeed without compression
 * because the static files are still valid without it, and zstd may not be
 * installed in all environments.
 *
 * @param l - parent logger for tagged output
 *
 * @example
 * ```ts
 * await postProcess({ l: rootLogger });
 * ```
 */
export async function postProcess(
  { l: parentLogger, }: { l: Logger; },
): Promise<void> {
  const l = tagged({
    tag: postProcess.name,
    l: parentLogger,
  },);

  // Zstd compression is best-effort; the build produces valid output without it.
  // Environments without zstd installed still get a complete build.
  try {
    await spawn(
      'zstd',
      [
        '-z',
        '-f',
        '-v',
        '--no-check',
        '-T0',
        '--exclude-compressed',
        '--no-content-size',
        '-r',
        '--adapt',
        DIST,
      ],
    );
    l.info('compressed with zstd',);
  }
  catch (zstdError) {
    l.error(`zstd compression failed: ${String(zstdError,)}`,);
  }
}
