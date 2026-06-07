/**
 * Host source-file helper functions for mutation orchestration.
 *
 * @example
 * ```ts
 * reportNameForSource('src/io/glob.ts');
 * ```
 */

/**
 * Converts a source file path into a unique JSON report filename.
 *
 * @param sourceFile - Package-relative source file.
 *
 * @returns Report filename under the host reports directory.
 *
 * @example
 * ```ts
 * reportNameForSource('src/io/glob.ts');
 * // 'src__io__glob.ts.json'
 * ```
 */
export function reportNameForSource(sourceFile: string,): string {
  return `${sourceFile.split('/',)
    .join('__',)}.json`;
}

/**
 * Resolves source files requested by CLI against dynamic package selection.
 *
 * @param options - All dynamically selected files and CLI filters.
 *
 * @returns Source files to mutate.
 *
 * @example
 * ```ts
 * resolveRequestedSources({ allSources: ['src/a.ts'], requested: [] });
 * ```
 */
export function resolveRequestedSources(options: {
  readonly allSources: readonly string[];
  readonly requested: readonly string[];
},): readonly string[] {
  if (options.requested
    .length
    === 0)
    return options.allSources;

  /**
   * Allowed production source files.
   */
  const allowed = new Set(options.allSources,);
  /**
   * Requested files missing from production source set.
   */
  const missing = options.requested
    .filter(function notAllowed(source,): boolean {
      return !allowed.has(source,);
    },);

  if (missing.length > 0)
    throw new Error(`Requested mutation sources are not production sources: ${missing.join(', ',)}`,);

  return options.requested;
}
