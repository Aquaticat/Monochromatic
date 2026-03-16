/**
 * Post-processing for the SSG build.
 *
 * Minifies HTML files and compresses output with zstd.
 */
import { readFile, writeFile, } from 'node:fs/promises';

import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import spawn from 'nano-spawn';
import rehypeParse from 'rehype-parse';
import rehypePresetMinify from 'rehype-preset-minify';
import rehypeStringify from 'rehype-stringify';
import readdir from 'tiny-readdir-glob';
import { unified, } from 'unified';

import type { Logger, } from '../lib/types.ts';
import { DIST, } from './write-page.ts';

/**
 * Minifies all generated HTML files and compresses with zstd.
 *
 * Zstd compression failure is non-fatal: builds succeed without compression
 * because the static files are still valid without it, and zstd may not be
 * installed in all environments.
 *
 * @param l - parent logger for tagged output
 */
export async function postProcess(
  { l: parentLogger, }: { l: Logger; },
): Promise<void> {
  const l = tagged({ tag: postProcess.name, l: parentLogger, },);
  const htmlFiles = await readdir(`${DIST}/**/*.html`,);

  await Promise.all(htmlFiles.files.map(async function minifyHtml(htmlPath,) {
    const content = await readFile(htmlPath, 'utf8',);
    const minified = String(
      await unified()
        .use(rehypeParse,)
        .use(rehypePresetMinify,)
        .use(rehypeStringify,)
        .process(content,),
    );
    await writeFile(htmlPath, minified, 'utf8',);
  },),);

  l.info(`minified ${htmlFiles.files.length} HTML files`,);

  // Zstd compression is best-effort; the build produces valid output without it.
  // Environments without zstd installed still get a complete build.
  try {
    await spawn('zstd', [
      '-z', '-f', '-v', '--no-check', '-T0',
      '--exclude-compressed', '--no-content-size',
      '-r', '--adapt', DIST,
    ],);
    l.info('compressed with zstd',);
  }
  catch (zstdError) {
    l.error(`zstd compression failed: ${String(zstdError,)}`,);
  }
}
