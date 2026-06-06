import { readdir, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  basename,
  join,
} from 'node:path';

import { trackGlob, } from '@monochromatic-dev/dev-script-file-enforcer/ts';

//region Constants and shapes: locate latest IntelliJ IDEA config directory

/**
 * Metadata for IntelliJ IDEA config directories discovered under JetBrains config root.
 */
export type IdeaOptionsDirectory = {
  readonly optionsDirectory: string;
  readonly productDirectory: string;
  readonly versionParts: readonly number[];
};

/**
 * IntelliJ product directory prefixes whose numeric suffix is an IDEA version.
 */
const IDEA_CONFIG_PREFIXES = [
  'IntelliJIdea',
  'IdeaIC',
] as const;

/**
 * LSP4IJ XML filename for global language-server settings.
 */
export const LANGUAGE_SERVERS_SETTINGS_XML = 'LanguageServersSettings.xml';

/**
 * LSP4IJ XML filename for user-defined language-server definitions.
 */
export const USER_DEFINED_LANGUAGE_SERVER_SETTINGS_XML = 'UserDefinedLanguageServerSettings.xml';

//endregion Constants and shapes

//region Version parsing: compare JetBrains IDEA config directories numerically

/**
 * Determines whether a product directory name belongs to IntelliJ IDEA.
 *
 * @param productName - Directory name under JetBrains config root.
 *
 * @returns Parsed version parts or undefined for non-IDEA names.
 *
 * @example
 * ```ts
 * const version = parseIdeaVersionParts({ productName: 'IntelliJIdea2026.2' });
 * ```
 */
function parseIdeaVersionParts({ productName, }: { readonly productName: string; },): readonly number[] | undefined {
  const prefix = IDEA_CONFIG_PREFIXES.find(function prefixMatches(candidate,): boolean {
    return productName.startsWith(candidate,);
  },);
  if (prefix === undefined) return undefined;
  const suffix = productName.slice(prefix.length,);
  const parts = suffix.split('.',);
  if (parts.length === 0) return undefined;
  const parsedParts = parts.map(function parseVersionPart(part,): number {
    return isDecimalDigits({ value: part, }) ? Number(part,) : Number.NaN;
  },);
  if (parsedParts.some(Number.isNaN,)) return undefined;
  return parsedParts;
}

/**
 * Checks whether text consists only of decimal digits.
 *
 * @param value - Text to inspect.
 *
 * @returns Whether every code unit is a decimal digit.
 *
 * @example
 * ```ts
 * isDecimalDigits({ value: '2026' });
 * ```
 */
function isDecimalDigits({ value, }: { readonly value: string; },): boolean {
  if (value.length === 0) return false;
  for (let cursorIndex = 0; cursorIndex < value.length; cursorIndex += 1) {
    const charCode = value.charCodeAt(cursorIndex,);
    if (charCode < 48 || charCode > 57) return false;
  }
  return true;
}

/**
 * Compares two IDEA version tuples.
 *
 * @param left - Left version tuple.
 *
 * @param right - Right version tuple.
 *
 * @returns Positive when left is newer, negative when right is newer, zero when equal.
 *
 * @example
 * ```ts
 * compareVersionParts({ left: [2026, 2], right: [2026, 1] });
 * ```
 */
function compareVersionParts(
  { left, right, }: { readonly left: readonly number[]; readonly right: readonly number[]; },
): number {
  const maxLength = Math.max(left.length, right.length,);
  for (let cursorIndex = 0; cursorIndex < maxLength; cursorIndex += 1) {
    const leftPart = left[cursorIndex] ?? 0;
    const rightPart = right[cursorIndex] ?? 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
}

//endregion Version parsing

//region Discovery: track IDEA config directories and pick latest IDEA version

/**
 * Lists IDEA product directories under JetBrains config root and records them
 * as a glob dependency for file-enforcer staleness tracking.
 *
 * @param jetBrainsConfigDirectory - JetBrains config root directory.
 *
 * @returns Product directory paths found directly under config root.
 *
 * @example
 * ```ts
 * const dirs = await trackedIdeaProductDirectories({ jetBrainsConfigDirectory });
 * ```
 */
async function trackedIdeaProductDirectories(
  { jetBrainsConfigDirectory, }: { readonly jetBrainsConfigDirectory: string; },
): Promise<readonly string[]> {
  const pattern = join(jetBrainsConfigDirectory, '*',);
  try {
    const entries = await readdir(
      jetBrainsConfigDirectory,
      { withFileTypes: true, },
    );
    const paths = entries
      .filter(function keepDirectory(entry,): boolean {
        return entry.isDirectory();
      },)
      .map(function toProductDirectory(entry,): string {
        return join(jetBrainsConfigDirectory, entry.name,);
      },);
    trackGlob({ pattern, paths, },);
    return paths;
  }
  catch {
    trackGlob({ pattern, paths: [], },);
    return [];
  }
}

/**
 * Converts one product directory path into an IDEA options candidate.
 *
 * @param productDirectory - Candidate JetBrains product directory.
 *
 * @returns IDEA options candidate, or undefined for non-IDEA paths.
 *
 * @example
 * ```ts
 * const candidate = ideaOptionsCandidate({ productDirectory });
 * ```
 */
function ideaOptionsCandidate({ productDirectory, }: { readonly productDirectory: string; },): IdeaOptionsDirectory | undefined {
  const versionParts = parseIdeaVersionParts({ productName: basename(productDirectory,), },);
  if (versionParts === undefined) return undefined;
  return {
    optionsDirectory: join(productDirectory, 'options',),
    productDirectory,
    versionParts,
  };
}

/**
 * Chooses the newer IDEA options candidate.
 *
 * @param current - Current candidate accumulator.
 *
 * @param candidate - Candidate being considered.
 *
 * @returns Newer candidate.
 *
 * @example
 * ```ts
 * const latest = keepLatestIdeaOptions(current, candidate);
 * ```
 */
function keepLatestIdeaOptions(
  current: IdeaOptionsDirectory | undefined,
  candidate: IdeaOptionsDirectory,
): IdeaOptionsDirectory {
  if (current === undefined) return candidate;
  const comparison = compareVersionParts({ left: candidate.versionParts, right: current.versionParts, },);
  if (comparison > 0) return candidate;
  if (comparison === 0 && candidate.productDirectory > current.productDirectory) return candidate;
  return current;
}

/**
 * Finds latest IntelliJ IDEA options directory. LSP4IJ files are checked later
 * so a newer IDEA install without Harper config yields a warning instead of
 * mutating an older IDEA version.
 *
 * @returns Latest IDEA options directory, or undefined when none exists.
 *
 * @example
 * ```ts
 * const latest = await latestIdeaOptionsDirectory();
 * ```
 */
export async function latestIdeaOptionsDirectory(): Promise<IdeaOptionsDirectory | undefined> {
  const jetBrainsConfigDirectory = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config',), 'JetBrains',);
  const productDirectories = await trackedIdeaProductDirectories({ jetBrainsConfigDirectory, },);
  return productDirectories
    .map(function toCandidate(productDirectory,): IdeaOptionsDirectory | undefined {
      return ideaOptionsCandidate({ productDirectory, },);
    },)
    .filter(function keepCandidate(candidate,): candidate is IdeaOptionsDirectory {
      return candidate !== undefined;
    },)
    .reduce<IdeaOptionsDirectory | undefined>(keepLatestIdeaOptions, undefined,);
}

//endregion Discovery
