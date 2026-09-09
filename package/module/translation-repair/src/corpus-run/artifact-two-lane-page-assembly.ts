import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type { SliceReplacement, } from '../splice-slices.ts';

//region Artifact page assembly
// WHAT THE PAGE-LEVEL GUARD DID TO THE COMPOSED PAGE. Each lane guards its own
// assembly, but the page ships per slice whatever the polish, the
// consolidation and the contest chose, and that composition is a document
// nobody assembled: the twenty-second `hakureico` pass of 2026-09-09 carried
// the consolidation's fresh rendering of two notes at slice 14 with the
// orphan the translate lane had already trimmed, and the page guard refused
// the page. The pass now runs the same guard over the composed page and
// records here what it cut and what it took back, so the artifact says what
// the page carries and every reader composes the same page.
//
// APPLIED FIRST when a slice's text is read (`would-ship-text.ts`), ahead of
// the polish, the consolidation and the contest, since it describes the page
// those three composed.

/**
 * Page-level guard outcome recorded in a settled artifact.
 *
 * @example
 * ```ts
 * const assembly: ArtifactPageAssembly = { trimmed: [], withdrawn: [], findings: [], };
 * ```
 */
export type ArtifactPageAssembly = {
  /**
   * Slices whose composed text the guard trimmed, with the text the page
   * carries: the composed text with an orphan definition block cut.
   */
  readonly trimmed: readonly SliceReplacement[];

  /**
   * Slices whose composed text the guard took back, so the page carries the
   * archive's own wording there, or nothing at an anchor.
   */
  readonly withdrawn: readonly number[];

  /**
   * What the guard did, in the assembly guard's wording.
   */
  readonly findings: readonly string[];
};

/**
 * Page assembly of an artifact whose guard cut nothing and took nothing back,
 * and of every artifact written before the guard existed.
 */
export const NO_PAGE_ASSEMBLY: ArtifactPageAssembly = {
  trimmed: [],
  withdrawn: [],
  findings: [],
};

/**
 * Keys the section is written with.
 */
const PAGE_ASSEMBLY_KEYS: readonly string[] = [
  'trimmed',
  'withdrawn',
  'findings',
];

/**
 * Keys a trimmed replacement is written with.
 */
const TRIMMED_KEYS: readonly string[] = [
  'sliceIndex',
  'replacementText',
];

/**
 * Reads one trimmed replacement.
 *
 * @param value - recorded replacement
 *
 * @param path - where it sits, for the parse error
 *
 * @returns The replacement
 *
 * @example
 * ```ts
 * const replacement = parseTrimmed({ value, path: `${path}.trimmed[0]`, },);
 * ```
 */
function parseTrimmed(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): SliceReplacement {
  /**
   * The replacement as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: TRIMMED_KEYS,
    path,
  },);
  return {
    sliceIndex: requireCount({
      value: record.sliceIndex,
      path: `${path}.sliceIndex`,
    },),
    replacementText: requireString({
      value: record.replacementText,
      path: `${path}.replacementText`,
    },),
  };
}

/**
 * Reads the page assembly section of a settled artifact.
 *
 * @param value - recorded section, absent on artifacts written before it
 *
 * @param path - where it sits, for the parse error
 *
 * @param required - whether this generation writes the section, so its
 * absence is a broken file rather than an older one
 *
 * @returns The section, empty on an older artifact
 *
 * @throws {@link ArtifactParseError} when a required section is absent or any
 * field is the wrong shape
 *
 * @example
 * ```ts
 * const assembly = parsePageAssembly({ value: artifact.pageAssembly, path: `${id}.pageAssembly`, required, },);
 * ```
 */
export function parsePageAssembly(
  {
    value,
    path,
    required,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly required: boolean;
  },
): ArtifactPageAssembly {
  if (value === undefined) {
    if (required) {
      throw new ArtifactParseError({
        path,
        reason: 'recorded page assembly from generation thirteen',
      },);
    }
    return NO_PAGE_ASSEMBLY;
  }
  /**
   * The section as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: PAGE_ASSEMBLY_KEYS,
    path,
  },);
  return {
    trimmed: requireArray({
      value: record.trimmed,
      path: `${path}.trimmed`,
    },)
      .map(function toReplacement(
        entry,
        at,
      ): SliceReplacement {
        return parseTrimmed({
          value: entry,
          path: `${path}.trimmed[${String(at,)}]`,
        },);
      },),
    withdrawn: requireArray({
      value: record.withdrawn,
      path: `${path}.withdrawn`,
    },)
      .map(function toIndex(
        entry,
        at,
      ): number {
        return requireCount({
          value: entry,
          path: `${path}.withdrawn[${String(at,)}]`,
        },);
      },),
    findings: requireArray({
      value: record.findings,
      path: `${path}.findings`,
    },)
      .map(function toFinding(
        entry,
        at,
      ): string {
        return requireString({
          value: entry,
          path: `${path}.findings[${String(at,)}]`,
        },);
      },),
  };
}

/**
 * What the page assembly says about one slice.
 *
 * @example
 * ```ts
 * const override: PageAssemblyOverride = { kind: 'trimmed', text: '[^1]: one', };
 * ```
 */
export type PageAssemblyOverride =
  | {
    /**
     * The page carries this text, the composed text with a block cut.
     */
    readonly kind: 'trimmed';

    /**
     * Text the page carries.
     */
    readonly text: string;
  }
  | {
    /**
     * The page carries the archive's own wording here, or nothing at an anchor.
     */
    readonly kind: 'withdrawn';
  }
  | {
    /**
     * The guard left this slice as the stages composed it.
     */
    readonly kind: 'untouched';
  };

/**
 * Reads what the page assembly did to one slice.
 *
 * @param pageAssembly - recorded section
 *
 * @param sliceIndex - slice asked about
 *
 * @returns The override, or that there is none
 *
 * @example
 * ```ts
 * const override = pageAssemblyOverrideAt({ pageAssembly, sliceIndex: 14, },);
 * ```
 */
export function pageAssemblyOverrideAt(
  {
    pageAssembly,
    sliceIndex,
  }: {
    readonly pageAssembly: ArtifactPageAssembly;
    readonly sliceIndex: number;
  },
): PageAssemblyOverride {
  if (pageAssembly
    .withdrawn
    .includes(sliceIndex,))
    return { kind: 'withdrawn', };
  /**
   * The trimmed replacement for this slice, if any.
   */
  const trimmed = pageAssembly
    .trimmed
    .find(function namesIt(replacement,): boolean {
      return replacement.sliceIndex === sliceIndex;
    },);
  if (trimmed === undefined)
    return { kind: 'untouched', };
  return {
    kind: 'trimmed',
    text: trimmed.replacementText,
  };
}

//endregion Artifact page assembly
