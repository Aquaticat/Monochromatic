/**
 * Raw V8 coverage reader for the toml-edit fuzz coverage gate.
 *
 * Node v26 runs the package `.ts` source directly and its type stripping is
 * position preserving (type syntax is blanked to whitespace, never shifted), so
 * a `NODE_V8_COVERAGE` JSON range offset indexes the on-disk `.ts` source
 * one-to-one. This module turns those raw ranges into a per-file covered-line
 * count for the shipped implementation files (the coverage targets), excluding
 * the fuzz, conformance, and test helpers that drive them.
 *
 * The metric is V8 block coverage projected to lines: paint a per-character
 * bitmap where the innermost range's count decides coverage (paint the longest
 * range first so a never-taken block inside a covered function wins), then a
 * source line counts as covered when it holds a non-whitespace character at a
 * covered offset. Coverage is unioned at the line-set level so a file split
 * across coverage processes stays the union of its runs, and no mutable bitmap
 * or map is ever passed across a function boundary.
 *
 * @module
 */

import {
  readFile,
  readdir,
} from 'node:fs/promises';
import {
  join,
  relative,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

//region V8 JSON shapes

/**
 * One V8 source range: a half-open character span and its execution count.
 */
type V8Range = {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly count: number;
};

/**
 * One V8 function coverage entry: the function's own range plus block ranges.
 */
type V8Function = {
  readonly functionName: string;
  readonly ranges: readonly V8Range[];
  readonly isBlockCoverage: boolean;
};

/**
 * One covered script: its source URL and the function coverage entries.
 */
type V8Script = {
  readonly url: string;
  readonly functions: readonly V8Function[];
};

/**
 * One `NODE_V8_COVERAGE` output file: the array of covered scripts.
 */
type V8CoverageFile = {
  readonly result: readonly V8Script[];
};

/**
 * Whether parsed JSON has the coverage-file shape (a `result` array), narrowing
 * from `unknown` without an `as` assertion.
 *
 * @param value - Parsed JSON to test before reading as coverage.
 *
 * @returns Whether `value` can be read as a coverage file.
 */
function isCoverageFile(value: unknown,): value is V8CoverageFile {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('result' in value)
    && Array.isArray(value.result,);
}

//endregion V8 JSON shapes

//region Public coverage shapes

/**
 * Line coverage for one target file.
 */
export type FileCoverage = {
  /**
   * Count of non-blank lines with a covered non-whitespace character.
   */
  readonly covered: number;
  /**
   * Count of non-blank lines (the line denominator).
   */
  readonly total: number;
  /**
   * One-based line numbers that hold code yet stayed uncovered.
   */
  readonly uncovered: readonly number[];
};

/**
 * Per-target-file coverage, keyed by package-relative path (`src/foo.ts`).
 */
export type CoverageMap = Readonly<Record<string, FileCoverage>>;

//endregion Public coverage shapes

//region URL classification

/**
 * Path fragments that mark a `src` `.ts` file as a fuzz, conformance, or test
 * helper that drives the implementation rather than a coverage target.
 */
const NON_TARGET_FRAGMENTS: readonly string[] = [
  '/fuzz/',
  '/conformance/',
  '.test.',
  'fuzz-budget.ts',
];

/**
 * Classification of one V8 script URL against the coverage-target rule.
 */
type UrlClass =
  | {
    readonly kind: 'target';
    readonly relPath: string;
    readonly absPath: string
  }
  | { readonly kind: 'other'; };

/**
 * Classify a V8 script URL as a shipped-implementation coverage target or not.
 *
 * @returns Target descriptor for `src` implementation files under `packageRoot`;
 *   otherwise an `other` marker for dependencies, helpers, and test files.
 *
 * @example
 * ```ts
 * const cls = classifyUrl({ url: script.url, packageRoot, },);
 * ```
 */
function classifyUrl(
  {
    url,
    packageRoot,
  }: {
    readonly url: string;
    readonly packageRoot: string;
  },
): UrlClass {
  if (!url.startsWith('file:',)) return { kind: 'other', };
  /**
   * Absolute filesystem path behind the `file:` URL.
   */
  const absPath = fileURLToPath(url,);
  /**
   * Package-relative path used as the coverage key.
   */
  const rel = relative(
    packageRoot,
    absPath,
  );
  if (!rel.startsWith('src/',)) return { kind: 'other', };
  if (!rel.endsWith('.ts',)) return { kind: 'other', };
  if (NON_TARGET_FRAGMENTS.some(function present(fragment,) {
    return rel.includes(fragment,);
  },)) {
    return { kind: 'other', };
  }
  return {
    kind: 'target',
    relPath: rel,
    absPath,
  };
}

//endregion URL classification

//region Bitmap painting and line projection

/**
 * Characters treated as whitespace, so a line of only these never counts as
 * code: space, tab, carriage return, form feed, vertical tab.
 */
const WHITESPACE_CHARS = ' \t\r\f\v';

/**
 * Paint a per-character covered bitmap from one script's ranges.
 *
 * Ranges nest; painting longest first lets the innermost range's count decide,
 * so a never-taken block inside a covered function paints uncovered.
 *
 * @returns Bitmap of length `length` where `1` marks a covered character offset.
 */
function paintBitmap(
  {
    length,
    functions,
  }: {
    readonly length: number;
    readonly functions: readonly V8Function[];
  },
): Uint8Array {
  /**
   * Every range across the script's functions, longest first.
   */
  const ranges = functions
    .flatMap(function rangesOf(fn,) { return fn.ranges; },)
    .toSorted(function byLengthDesc(
      a,
      b,
    ) {
      return (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset);
    },);
  /**
   * Covered bitmap, mutated as ranges paint over it from longest to shortest.
   */
  const bitmap = new Uint8Array(length,);
  for (const range of ranges) {
    /**
     * Covered when the range executed at least once.
     */
    const fill = range.count > 0 ? 1 : 0;
    /**
     * Clamp so a malformed range never writes past the source.
     */
    const end = Math.min(
      range.endOffset,
      length,
    );
    for (let offset = Math.max(
      range.startOffset,
      0,
    ); offset < end; offset += 1) {
      bitmap[offset] = fill;
    }
  }
  return bitmap;
}

/**
 * Whether `line` holds at least one non-whitespace character (is a code line).
 *
 * @returns Whether the line denominator should count this line.
 */
function lineHasCode({ line, }: { readonly line: string; },): boolean {
  for (const char of line) {
    if (!WHITESPACE_CHARS.includes(char,)) return true;
  }
  return false;
}

/**
 * Whether `line` holds a non-whitespace character at a covered bitmap offset.
 * Indexed in code units so the offset aligns with V8's character offsets.
 *
 * @returns Whether the line counts as covered.
 */
function lineHasCoveredCode(
  {
    line,
    start,
    bitmap,
  }: {
    readonly line: string;
    readonly start: number;
    readonly bitmap: Uint8Array;
  },
): boolean {
  for (let index = 0; index < line.length; index += 1) {
    if ((!WHITESPACE_CHARS.includes(line[index] ?? ' ',)) && (bitmap[start + index] === 1)) return true;
  }
  return false;
}

/**
 * Project one script's ranges onto the set of covered one-based line numbers.
 *
 * @returns Covered code-line numbers for this script.
 */
function projectCovered(
  {
    source,
    functions,
  }: {
    readonly source: string;
    readonly functions: readonly V8Function[];
  },
): ReadonlySet<number> {
  /**
   * Per-character covered bitmap, local to this projection.
   */
  const bitmap = paintBitmap({
    length: source.length,
    functions,
  },);
  /**
   * Covered one-based line numbers accumulated over the source lines.
   */
  const covered = new Set<number>();
  source.split('\n',)
    .reduce(
    function fold(
      offset,
      line,
      index,
    ) {
      if (lineHasCoveredCode({
        line,
        start: offset,
        bitmap,
      },)) covered.add(index + 1,);
      return offset + line.length
        + 1;
    },
    0,
  );
  return covered;
}

/**
 * Project a covered-line set onto per-file coverage counts.
 *
 * @returns Covered and total code-line counts plus the uncovered line numbers.
 */
function fileCoverageFrom(
  {
    source,
    coveredLines,
  }: {
    readonly source: string;
    readonly coveredLines: ReadonlySet<number>;
  },
): FileCoverage {
  /**
   * One-based numbers of code lines that stayed uncovered, pushed in order.
   */
  const uncovered: number[] = [];
  /**
   * Fold of covered and total code-line counts over the source lines.
   */
  const tally = source.split('\n',)
    .reduce(
    function fold(
      acc,
      line,
      index,
    ) {
      if (!lineHasCode({ line, },)) return acc;
      /**
       * One-based line number for this code line.
       */
      const lineNumber = index + 1;
      if (coveredLines.has(lineNumber,)) {
        return {
          covered: acc.covered + 1,
          total: acc.total + 1,
        };
      }
      uncovered.push(lineNumber,);
      return {
        covered: acc.covered,
        total: acc.total + 1,
      };
    },
    {
      covered: 0,
      total: 0,
    },
  );
  return {
    covered: tally.covered,
    total: tally.total,
    uncovered,
  };
}

//endregion Bitmap painting and line projection

//region Aggregation

/**
 * Per-target accumulation across coverage files before line projection.
 */
type TargetAccumulator = {
  /**
   * On-disk source text for the target file.
   */
  readonly source: string;
  /**
   * Covered line numbers unioned across coverage files.
   */
  readonly covered: Set<number>;
};

/**
 * Coverage target extracted from one V8 coverage JSON file.
 */
type CoverageTarget = {
  /**
   * Package-relative target path used as the coverage map key.
   */
  readonly relPath: string;
  /**
   * Absolute path to the target source file.
   */
  readonly absPath: string;
  /**
   * V8 function coverage ranges for this target occurrence.
   */
  readonly functions: readonly V8Function[];
};

/**
 * Target projected onto covered line numbers after source loading.
 */
type ProjectedTarget = {
  /**
   * Package-relative target path used as the coverage map key.
   */
  readonly relPath: string;
  /**
   * On-disk source text for the target file.
   */
  readonly source: string;
  /**
   * Covered line numbers for this target occurrence.
   */
  readonly covered: ReadonlySet<number>;
};

/**
 * Reads one V8 coverage JSON file and returns its package target scripts.
 *
 * @param coverageDir - directory holding V8 coverage JSON files
 *
 * @param file - coverage JSON filename inside `coverageDir`
 *
 * @param packageRoot - absolute package root used for target classification
 *
 * @returns coverage targets extracted from the file
 */
async function readCoverageTargets(
  {
    coverageDir,
    file,
    packageRoot,
  }: {
    readonly coverageDir: string;
    readonly file: string;
    readonly packageRoot: string;
  },
): Promise<readonly CoverageTarget[]> {
  /**
   * Parsed coverage file, narrowed by assertion from `unknown`.
   */
  const parsed: unknown = JSON.parse(await readFile(
    join(
      coverageDir,
      file,
    ),
    'utf8',
  ),);
  if (!isCoverageFile(parsed,)) throw new Error('Malformed V8 coverage JSON: expected a result array',);

  return parsed.result.flatMap(function targetFromScript(script,): readonly CoverageTarget[] {
    /**
     * Target classification for this script's URL.
     */
    const cls = classifyUrl({
      url: script.url,
      packageRoot,
    },);
    if (cls.kind !== 'target') return [];
    return [{
      relPath: cls.relPath,
      absPath: cls.absPath,
      functions: script.functions,
    },];
  },);
}

/**
 * Reads target source text through a cache so each file is loaded once.
 *
 * @param sourceCache - promise cache keyed by absolute source path
 *
 * @param absPath - source file path to read
 *
 * @returns promise resolving to source text
 */
function sourcePromiseFor(
  {
    sourceCache,
    absPath,
  }: {
    readonly sourceCache: Map<string, Promise<string>>;
    readonly absPath: string;
  },
): Promise<string> {
  /**
   * Existing in-flight or fulfilled read for this source file.
   */
  const existing = sourceCache.get(absPath,);
  if (existing !== undefined)
    return existing;

  /**
   * New source read stored immediately so concurrent target projections share it.
   */
  const sourcePromise = readFile(
    absPath,
    'utf8',
  );
  sourceCache.set(
    absPath,
    sourcePromise,
  );
  return sourcePromise;
}

/**
 * Projects one target's V8 ranges onto covered line numbers.
 *
 * @param target - coverage target to project
 *
 * @param sourceCache - shared source read cache
 *
 * @returns projected target with source and covered lines
 */
async function projectTarget(
  {
    target,
    sourceCache,
  }: {
    readonly target: CoverageTarget;
    readonly sourceCache: Map<string, Promise<string>>;
  },
): Promise<ProjectedTarget> {
  /**
   * Source text loaded through the shared cache.
   */
  const source = await sourcePromiseFor({
    sourceCache,
    absPath: target.absPath,
  },);
  return {
    relPath: target.relPath,
    source,
    covered: projectCovered({
      source,
      functions: target.functions,
    },),
  };
}

/**
 * Unions projected target coverage by package-relative path.
 *
 * @param targets - projected target occurrences across all coverage files
 *
 * @returns accumulator map keyed by package-relative target path
 */
function mergeProjectedTargets(targets: readonly ProjectedTarget[],): Map<string, TargetAccumulator> {
  return targets.reduce<Map<string, TargetAccumulator>>(
    function merge(perFile, target,) {
      /**
       * Existing file accumulator, when another coverage script already reached the file.
       */
      const existing = perFile.get(target.relPath,);
      if (existing === undefined) {
        perFile.set(
          target.relPath,
          {
            source: target.source,
            covered: new Set(target.covered,),
          },
        );
        return perFile;
      }

      for (const lineNumber of target.covered) {
        existing.covered
          .add(lineNumber,);
      }
      return perFile;
    },
    new Map<string, TargetAccumulator>(),
  );
}

/**
 * Read every `NODE_V8_COVERAGE` JSON file in `coverageDir` and project the
 * target files' ranges onto per-file line coverage.
 *
 * @returns Coverage keyed by package-relative path; only target files appear.
 *
 * @example
 * ```ts
 * const map = await aggregateCoverage({ coverageDir, packageRoot, },);
 * ```
 */
export async function aggregateCoverage(
  {
    coverageDir,
    packageRoot,
  }: {
    readonly coverageDir: string;
    readonly packageRoot: string;
  },
): Promise<CoverageMap> {
  /**
   * Coverage JSON filenames, filtered before parallel reading.
   */
  const coverageFiles = (await readdir(coverageDir,))
    .filter(function isCoverageJson(file,) {
      return file.endsWith('.json',);
    },);
  /**
   * Target script records extracted from every coverage file.
   */
  const targets = (await Promise.all(coverageFiles.map(function readTargets(file,) {
    return readCoverageTargets({
      coverageDir,
      file,
      packageRoot,
    },);
  },)))
    .flat();
  /**
   * Source read cache shared across target projections.
   */
  const sourceCache = new Map<string, Promise<string>>();
  /**
   * Per-target covered-line projections, run concurrently once targets are known.
   */
  const projectedTargets = await Promise.all(targets.map(function project(target,) {
    return projectTarget({
      target,
      sourceCache,
    },);
  },));
  /**
   * Per-file accumulation of covered lines across all projected targets.
   */
  const perFile = mergeProjectedTargets(projectedTargets,);

  return Object.fromEntries(
    [...perFile.entries(),].map(function project([relPath, info,],) {
      return [
        relPath,
        fileCoverageFrom({
          source: info.source,
          coveredLines: info.covered,
        },),
      ] as const;
    },),
  );
}

//endregion Aggregation
