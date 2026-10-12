/**
 The compositor version the checks need, and how to read a version from the compositor's `--version` line.
 
 The key names F1 to F24 and Menu, the chords, the timed hold with the client's key repeat, Unicode typing, exact sizes
 and focus return after a dialog belong to compositor 0.4.0. An older compositor answers `unknown key` for them, so the
 run refuses to start with a message that names the fix instead of failing a dozen checks one by one.
 
 @example
 ```ts
 import { compositorVersionProblem, } from './compositor-version.ts';
 
 compositorVersionProblem({ output: 'monochromatic-nested-wayland-session 0.3.0', path: '/c', },); // a message
 ```
 
 @packageDocumentation
 */

/**
 The oldest compositor the checks run against.
 */
export const MINIMUM_COMPOSITOR_VERSION = '0.4.0';

/**
 How many numbers a version has: major, minor and patch.
 */
const VERSION_PARTS = 3;

/**
 Reads the version number from the text `--version` prints, which ends with the number.
 
 @param output - the compositor's `--version` output, such as `monochromatic-nested-wayland-session 0.4.0`
 
 @returns the `[major, minor, patch]` numbers, or an empty list when the last word is not a version
 
 @example
 ```ts
 parseCompositorVersion('monochromatic-nested-wayland-session 0.4.0',); // [0, 4, 0]
 ```
 */
export function parseCompositorVersion(output: string,): readonly number[] {
  /**
   The words of the output.
   */
  const words = output.trim()
    .split(' ',);

  /**
   The last word of the output.
   */
  const word = words.at(-1,) ?? '';

  /**
   The dot-separated parts of that word as numbers.
   */
  const parts = word.split('.',)
    .map(Number,);
  if ((parts.length !== VERSION_PARTS) || parts.some(function isNotNumber(part,): boolean {
    return Number.isNaN(part,);
  },))
    return [];
  return parts;
}

/**
 Tells whether a version is the minimum or newer.
 
 @param version - the version found, as `[major, minor, patch]`
 
 @param minimum - the oldest acceptable version
 
 @returns whether `version` is at least `minimum`
 
 @example
 ```ts
 isAtLeast({ version: [0, 4, 1,], minimum: [0, 4, 0,], },); // true
 ```
 */
export function isAtLeast(
  {
    version,
    minimum,
  }: {
    readonly minimum: readonly number[];
    readonly version: readonly number[];
  },
): boolean {
  for (const [index, wanted,] of minimum.entries()) {
    /**
     The part of the version at the same position.
     */
    const found = version[index] ?? 0;
    if (found !== wanted)
      return found > wanted;
  }
  return true;
}

/**
 Explains why a compositor cannot run the checks.
 
 @param output - the compositor's `--version` output
 
 @param path - the executable that was asked
 
 @returns a message that names the problem and the fix, or an empty string when the version is fine
 
 @example
 ```ts
 compositorVersionProblem({ output: 'x 0.4.0', path: '/c', },); // ''
 ```
 */
export function compositorVersionProblem(
  {
    output,
    path,
  }: {
    readonly output: string;
    readonly path: string;
  },
): string {
  /**
   The version the compositor reported.
   */
  const version = parseCompositorVersion(output,);
  if (version.length === 0)
    return `the compositor ${path} printed no version ("${output.trim()}"); the checks need ${MINIMUM_COMPOSITOR_VERSION} or newer`;
  if (isAtLeast({
    version,
    minimum: parseCompositorVersion(MINIMUM_COMPOSITOR_VERSION,),
  },))
    return '';
  return `the compositor ${path} is ${version.join('.',)}; the checks need ${MINIMUM_COMPOSITOR_VERSION} or newer. `
    + 'Install it (mise upgrade cargo:monochromatic-nested-wayland-session) and raise PINNED_COMPOSITOR_VERSION, '
    + 'or set E2E_COMPOSITOR to a build of package/cli/nested-wayland-session.';
}
