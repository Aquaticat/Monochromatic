/**
 * File writing utility for the SSG dist directory.
 *
 * Creates parent directories as needed and writes content to the
 * output path under `dist/`.
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

/** Output directory for generated static files. */
export const DIST = 'dist';

/**
 * Writes content to a file in the dist directory, creating parent dirs as needed.
 *
 * @param relativePath - path relative to dist/
 *
 * @param content - file content to write
 *
 * @example
 * ```ts
 * await writePage({ relativePath: 'index.html', content: '<html>...</html>' });
 * ```
 */
export async function writePage(
  {
    relativePath,
    content,
  }: {
    relativePath: string;
    content: string;
  },
): Promise<void> {
  const fullPath = join(
    DIST,
    relativePath,
  );
  await mkdir(
    join(
      fullPath,
      '..',
    ),
    { recursive: true, },
  );
  await writeFile(
    fullPath,
    content,
    'utf8',
  );
}
