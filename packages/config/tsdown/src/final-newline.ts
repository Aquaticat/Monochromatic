import {
  glob,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

//region Final-LF content normalization

/**
 * Canonicalizes non-empty text to exactly one final LF while preserving every
 * byte before the final LF run.
 *
 * Empty content remains empty because an empty generated artifact and a
 * newline-only artifact have different semantics.
 *
 * @param content - Generated text content to canonicalize.
 *
 * @returns Canonical content with zero or one final LF according to emptiness.
 *
 * @example
 * ```ts
 * normalizeFinalLf('export {};\n\n');
 * // 'export {};\n'
 * ```
 */
export function normalizeFinalLf(content: string,): string {
  if (content.length === 0)
    return content;

  /**
   * Cursor just after last byte that is not part of final LF run.
   */
  let contentEnd = content.length;

  while ((contentEnd > 0) && (content.charAt(contentEnd - 1,) === '\n'))
    contentEnd -= 1;

  if (contentEnd === (content.length - 1))
    return content;

  return `${content.slice(0, contentEnd,)}\n`;
}

//endregion Final-LF content normalization

//region Generated Node output discovery

/**
 * Suffixes emitted for Node JavaScript and TypeScript declaration artifacts.
 *
 * Source-map and copied-asset suffixes are intentionally absent because this
 * module only owns executable JavaScript and declaration text.
 *
 * @example
 * ```ts
 * GENERATED_NODE_TEXT_SUFFIXES.includes('.mjs');
 * ```
 */
const GENERATED_NODE_TEXT_SUFFIXES = [
  '.cjs',
  '.cts',
  '.js',
  '.mjs',
  '.mts',
  '.ts',
] as const;

/**
 * Returns whether relative output path belongs to generated JavaScript or a
 * TypeScript declaration artifact.
 *
 * @param relativePath - Path relative to tsdown output directory.
 *
 * @returns Whether path has an owned generated-text suffix.
 *
 * @example
 * ```ts
 * isGeneratedNodeTextOutput('index.d.mts');
 * // true
 * ```
 */
function isGeneratedNodeTextOutput(relativePath: string,): boolean {
  return GENERATED_NODE_TEXT_SUFFIXES.some(
    function hasGeneratedTextSuffix(suffix,): boolean {
      return relativePath.endsWith(suffix,);
    },
  );
}

/**
 * Normalizes one generated output when necessary.
 *
 * @param outputDir - Absolute output directory containing generated file.
 * @param relativePath - File path relative to output directory.
 *
 * @returns Relative path when file changed, otherwise undefined.
 *
 * @example
 * ```ts
 * await normalizeGeneratedTextOutput({
 *   outputDir: '/tmp/dist',
 *   relativePath: 'index.mjs',
 * });
 * ```
 */
async function normalizeGeneratedTextOutput(
  {
    outputDir,
    relativePath,
  }: {
    readonly outputDir: string;
    readonly relativePath: string;
  },
): Promise<string | undefined> {
  /**
   * Absolute generated output path used for filesystem reads and writes.
   */
  const outputPath = join(outputDir, relativePath,);
  /**
   * Generated text before canonicalization.
   */
  const content = await readFile(outputPath, 'utf8',);
  /**
   * Generated text after final-LF canonicalization.
   */
  const normalizedContent = normalizeFinalLf(content,);

  if (normalizedContent === content)
    return undefined;

  await writeFile(outputPath, normalizedContent, 'utf8',);
  return relativePath;
}

/**
 * Narrows optional normalized path to path that changed.
 *
 * @param relativePath - Optional relative output path from one normalization.
 *
 * @returns Whether value is changed output path.
 *
 * @example
 * ```ts
 * ['index.mjs', undefined].filter(isNormalizedPath);
 * // ['index.mjs']
 * ```
 */
function isNormalizedPath(relativePath: string | undefined,): relativePath is string {
  return relativePath !== undefined;
}

/**
 * Canonicalizes generated JavaScript and declaration files in output directory.
 *
 * Discovery is recursive so per-entry builds and nested output names share one
 * interface. Paths are sorted before work begins to keep logs and tests stable.
 *
 * @param outputDir - Absolute tsdown Node output directory.
 *
 * @returns Relative paths changed during this invocation.
 *
 * @example
 * ```ts
 * await normalizeGeneratedTextOutputs({ outputDir: '/tmp/package/dist/final/node' });
 * ```
 */
export async function normalizeGeneratedTextOutputs(
  { outputDir, }: { readonly outputDir: string; },
): Promise<readonly string[]> {
  /**
   * Relative generated text paths selected from recursive output walk.
   */
  const relativePaths = (await Array.fromAsync(glob('**/*', { cwd: outputDir, },),))
    .filter(isGeneratedNodeTextOutput,)
    .toSorted();
  /**
   * Optional changed path from every independently normalized output.
   */
  const normalizedPaths = await Promise.all(relativePaths.map(
    async function normalizeRelativePath(relativePath,): Promise<string | undefined> {
      return normalizeGeneratedTextOutput({ outputDir, relativePath, },);
    },
  ),);

  return normalizedPaths.filter(isNormalizedPath,);
}

//endregion Generated Node output discovery
