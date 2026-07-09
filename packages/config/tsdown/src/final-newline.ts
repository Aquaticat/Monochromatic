import {
  glob,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

//region Final-LF content normalization

/**
 * Finds cursor just after last byte that is not part of final LF run.
 *
 * @param content - Generated text whose final LF run is being located.
 *
 * @returns Content length with final LF bytes excluded.
 *
 * @example
 * ```ts
 * finalLfStart('content\n\n');
 * // 7
 * ```
 */
function finalLfStart(content: string,): number {
  for (let index = content.length - 1; index >= 0; index -= 1) {
    if (content.charAt(index,) !== '\n')
      return index + 1;
  }

  return 0;
}

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
  const contentEnd = finalLfStart(content,);

  if (contentEnd === (content.length - 1))
    return content;

  return `${content.slice(
    0,
    contentEnd,
  )}\n`;
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
 * Sentinel returned when generated output already has canonical ending.
 *
 * @example
 * ```ts
 * typeof OUTPUT_UNCHANGED === 'symbol';
 * ```
 */
const OUTPUT_UNCHANGED: unique symbol = Symbol('generated output ending unchanged',);

/**
 * Normalizes one generated output when necessary.
 *
 * @param outputDir - Absolute output directory containing generated file.
 *
 * @param relativePath - File path relative to output directory.
 *
 * @returns Relative path when file changed, otherwise unchanged sentinel.
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
): Promise<string | typeof OUTPUT_UNCHANGED> {
  /**
   * Absolute generated output path used for filesystem reads and writes.
   */
  const outputPath = join(
    outputDir,
    relativePath,
  );
  /**
   * Generated text before canonicalization.
   */
  const content = await readFile(
    outputPath,
    'utf8',
  );
  /**
   * Generated text after final-LF canonicalization.
   */
  const normalizedContent = normalizeFinalLf(content,);

  if (normalizedContent === content)
    return OUTPUT_UNCHANGED;

  await writeFile(
    outputPath,
    normalizedContent,
    'utf8',
  );
  return relativePath;
}

/**
 * Narrows normalization result to path that changed.
 *
 * @param relativePath - Changed relative path or unchanged sentinel.
 *
 * @returns Whether value is changed output path.
 *
 * @example
 * ```ts
 * ['index.mjs', OUTPUT_UNCHANGED].filter(isNormalizedPath);
 * // ['index.mjs']
 * ```
 */
function isNormalizedPath(
  relativePath: string | typeof OUTPUT_UNCHANGED,
): relativePath is string {
  return (typeof relativePath) === 'string';
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
  const relativePaths = (await Array.fromAsync(glob(
    '**/*',
    { cwd: outputDir, },
  ),))
    .filter(isGeneratedNodeTextOutput,)
    .toSorted();
  /**
   * Changed path or sentinel from every independently normalized output.
   */
  const normalizedPaths = await Promise.all(relativePaths.map(
    function normalizeRelativePath(
      relativePath,
    ): Promise<string | typeof OUTPUT_UNCHANGED> {
      return normalizeGeneratedTextOutput({
        outputDir,
        relativePath,
      },);
    },
  ),);

  return normalizedPaths.filter(isNormalizedPath,);
}

//endregion Generated Node output discovery
