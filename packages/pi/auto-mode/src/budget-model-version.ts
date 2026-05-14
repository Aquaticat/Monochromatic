/**
 * Model version extraction and comparison helpers.
 *
 * Walks model IDs, extracts a normalized "major version" token,
 * and ranks models so the budget-model strategies can find the
 * cheapest entry within the active model's major-version family.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';

/**
 * Minimum digit count for a numeric token to be treated as a date
 * stamp rather than a version number.
 *
 * Tokens with this many digits or more (e.g. `20240101`, `2024-01-01`
 * after splitting) are skipped during version extraction so dates
 * embedded in model IDs do not clobber the version detection.
 */
const DATE_TOKEN_DIGIT_COUNT = 8;

/**
 * Extract the major version number from a model ID.
 *
 * Finds the first digit sequence in any token, skipping
 * date-like tokens (8+ digits).
 *
 * @param id - the model ID string
 *
 * @returns the major version number, or `null` if not found
 *
 * @example
 * ```typescript
 * extractMajorVersion("gpt-4o-mini"); // 4
 * extractMajorVersion("claude-3.5-sonnet"); // 3
 * extractMajorVersion("model-20240101-v2"); // 2 (date skipped)
 * ```
 */
function extractMajorVersion(
  id: string,
): number | null {
  /** ID split on `.`, `_`, `-`, `:`, and whitespace so each segment can be inspected for a numeric prefix. */
  const tokens = id
    .replaceAll(
      /[._\-:]/g,
      ' ',
    )
    .split(/\s+/,);
  for (const t of tokens) {
    if (/^\d+$/.test(t,) && (t.length >= DATE_TOKEN_DIGIT_COUNT))
      continue;
    /** First digit run inside the current token, e.g. `4` in `4o` or `3` in `3.5`. */
    const match = /(\d+)/.exec(t,);
    if ((match !== null) && (match[1] !== undefined)) {
      return Number.parseInt(
        match[1],
        10,
      );
    }
  }
  return null;
}

/**
 * Extract version numbers from a model ID, skipping date-like tokens.
 *
 * @param id - the model ID string
 *
 * @returns array of version numbers found
 *
 * @example
 * ```typescript
 * extractVersionNumbers("claude-3.5-sonnet"); // [3, 5]
 * ```
 */
function extractVersionNumbers(
  id: string,
): number[] {
  /** ID split on `.`, `_`, `-`, `:`, and whitespace so each segment can be inspected for a numeric prefix. */
  const tokens = id
    .replaceAll(
      /[._\-:]/g,
      ' ',
    )
    .split(/\s+/,);
  /** Accumulator for every per-token version number, preserving original order so lexicographic compare works. */
  const nums: number[] = [];
  /** Local alias for the date-token cutoff; kept inline so the regex literal stays readable in context. */
  const EIGHT = 8;
  for (const t of tokens) {
    if (/^\d+$/.test(t,) && (t.length >= EIGHT))
      continue;
    /** First digit run inside the current token; null when the token is non-numeric. */
    const m = /(\d+)/.exec(t,);
    if ((m !== null) && (m[1] !== undefined)) {
      nums.push(
        Number.parseInt(
          m[1],
          10,
        ),
      );
    }
  }
  return nums;
}

/**
 * Compare two models by version numbers.
 *
 * Higher version numbers first, then prefer shorter vectors
 * (aliases over dated snapshots).
 *
 * @returns comparison result
 *
 * @example
 * ```typescript
 * const cmp = compareVersions({ a: modelA, b: modelB });
 * ```
 */
function compareVersions(
  {
    a,
    b,
  }: {
    a: Model<Api>;
    b: Model<Api>;
  },
): number {
  /** Version vector for `a`, e.g. `[3, 5]` for `claude-3.5-sonnet`. */
  const av = extractVersionNumbers(a.id,);
  /** Version vector for `b`, compared positionally against `av`. */
  const bv = extractVersionNumbers(b.id,);
  /** Number of positions to walk; missing components on either side default to 0 in the loop. */
  const maxLen = Math.max(
    av.length,
    bv.length,
  );
  for (let i = 0; i < maxLen; i++) {
    /** Per-position delta with `b` first so higher versions sort earlier (descending). */
    const diff = (bv[i] ?? 0) - (av[i] ?? 0);
    if (diff !== 0)
      return diff;
  }
  return av.length - bv.length;
}

/**
 * Find the cheapest models across the top N major version groups,
 * sorted by cost then version.
 *
 * `majorVersions`: 1 = latest only, 2 = latest + previous, 0 = all.
 *
 * @returns cheapest models sorted by cost (ascending) then version (descending)
 *
 * @example
 * ```typescript
 * findCheapestInMajorVersions({ models, majorVersions: 1 }); // latest major only
 * ```
 */
function findCheapestInMajorVersions(
  {
    models,
    majorVersions,
  }: {
    models: Model<Api>[];
    majorVersions: number;
  },
): Model<Api>[] {
  /** Distinct major-version numbers seen across the candidate set. */
  const allVersions = new Set<number>();
  for (const m of models) {
    /** Major version extracted from this model's ID, or `null` when the ID has no numeric token. */
    const ver = extractMajorVersion(m.id,);
    if (ver !== null)
      allVersions.add(ver,);
  }
  /** Major versions in descending order so `slice(0, N)` keeps the newest N families. */
  const sorted = [...allVersions,].toSorted(
    function desc(
      a,
      b,
    ) {
      return b - a;
    },
  );

  if (sorted.length === 0)
    return [];

  /** Subset of major versions to keep: all when `majorVersions === 0`, otherwise the newest N. */
  const included = majorVersions === 0
    ? sorted
    : sorted.slice(
      0,
      majorVersions,
    );
  /** Set form of `included` for O(1) membership checks in the filter below. */
  const includedSet = new Set(included,);

  /** Models whose major version is in the kept set; everything older has been excluded. */
  const eligible = models.filter(
    function hasVersion(m,) {
      /** Per-model major version used to test membership in `includedSet`. */
      const ver = extractMajorVersion(m.id,);
      return (ver !== null) && includedSet.has(ver,);
    },
  );

  return eligible.toSorted(
    function byCost(
      a,
      b,
    ) {
      /** Cost-only ordering; ties fall through to a version-based compare below. */
      const costDiff = a.cost.input - b.cost.input;
      if (costDiff !== 0)
        return costDiff;
      return compareVersions({
        a,
        b,
      },);
    },
  );
}

export {
  compareVersions,
  extractMajorVersion,
  extractVersionNumbers,
  findCheapestInMajorVersions,
};
