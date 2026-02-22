import { Glob, } from 'bun';

/**
 * Expands a glob pattern against the filesystem and returns matched file paths.
 * @param pattern - Glob pattern (e.g., `./packages/*​/src/*.ts`)
 * @returns Array of matched absolute-ish paths relative to cwd
 */
export async function expandGlob(pattern: string): Promise<readonly string[]> {
  /** Bun glob instance scoped to cwd */
  const glob = new Glob(pattern);
  /** Collected match paths */
  const matches: string[] = [];
  for await (const match of glob.scan({ dot: true, })) {
    matches.push(match);
  }
  return matches;
}

/**
 * Extracts wildcard segments from a source path using the source glob pattern,
 * then substitutes them into the destination glob pattern.
 *
 * Each `*` in the source pattern captures one path segment value; those captured
 * values are inserted positionally into the `*` slots of the dest pattern.
 *
 * @param sourcePattern - Glob pattern used to match the source (e.g., `packages/*​/src/*.ts`)
 * @param destPattern - Glob pattern for the destination (e.g., `temp/*​/src/*.ts`)
 * @param sourcePath - Concrete path that matched sourcePattern
 * @returns Concrete destination path with wildcards filled in
 * @throws When wildcard counts don't match between source and dest patterns
 */
export function mirrorGlobPath(
  sourcePattern: string,
  destPattern: string,
  sourcePath: string,
): string {
  /** Segments of the source pattern split by `*` */
  const sourceParts = sourcePattern.split('*');
  /** Segments of the dest pattern split by `*` */
  const destParts = destPattern.split('*');

  /** Number of wildcards in source vs dest must match for positional substitution */
  const sourceWildcardCount = sourceParts.length - 1;
  const destWildcardCount = destParts.length - 1;
  if (sourceWildcardCount !== destWildcardCount) {
    throw new Error(
      `Wildcard count mismatch: source "${sourcePattern}" has ${String(sourceWildcardCount)}`
      + ` but dest "${destPattern}" has ${String(destWildcardCount)}`,
    );
  }

  /** Values captured from each wildcard position in the source path */
  const captured: string[] = [];
  // Walk the source path, peeling off fixed prefixes to isolate wildcard captures --
  // let needed because remainder shrinks with each iteration
  let remainder = sourcePath;
  for (let partIndex = 0; partIndex < sourceParts.length; partIndex++) {
    /** Fixed text before (or after) the current wildcard */
    const fixedPart = sourceParts[partIndex]!;
    if (!remainder.startsWith(fixedPart)) {
      throw new Error(
        `Source path "${sourcePath}" does not match pattern "${sourcePattern}" at segment "${fixedPart}"`,
      );
    }
    remainder = remainder.slice(fixedPart.length);

    if (partIndex < sourceWildcardCount) {
      /** Position of the next fixed segment, marking the end of this wildcard capture */
      const nextFixed = sourceParts[partIndex + 1]!;
      const nextFixedPos = nextFixed === '' ? remainder.length : remainder.indexOf(nextFixed);
      if (nextFixedPos === -1) {
        throw new Error(
          `Source path "${sourcePath}" does not match pattern "${sourcePattern}"`,
        );
      }
      captured.push(remainder.slice(0, nextFixedPos));
      remainder = remainder.slice(nextFixedPos);
    }
  }

  /** Reconstructed destination path with wildcards replaced by captured values */
  const result: string[] = [];
  for (let destIndex = 0; destIndex < destParts.length; destIndex++) {
    result.push(destParts[destIndex]!);
    if (destIndex < destWildcardCount) {
      result.push(captured[destIndex]!);
    }
  }
  return result.join('');
}
