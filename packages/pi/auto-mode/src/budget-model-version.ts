/**
 * Model version extraction and comparison helpers.
 *
 * Extracted from budget-model.ts to stay within the line limit.
 *
 * @module
 */

import type {
  Api,
  Model,
} from "@earendil-works/pi-ai";

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
  const tokens = id.replaceAll(
    /[._\-:]/g,
    " ",
  ).split(/\s+/);
  for (const t of tokens) {
    const EIGHT = 8;
    if (/^\d+$/.test(t) && t.length >= EIGHT) continue;
    const match = /(\d+)/.exec(t);
    if (match !== null && match[1] !== undefined) {
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
  const tokens = id.replaceAll(
    /[._\-:]/g,
    " ",
  ).split(/\s+/);
  const nums: number[] = [];
  const EIGHT = 8;
  for (const t of tokens) {
    if (/^\d+$/.test(t) && t.length >= EIGHT) continue;
    const m = /(\d+)/.exec(t);
    if (m !== null && m[1] !== undefined) {
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
 * @param a - first model
 *
 * @param b - second model
 *
 * @returns comparison result
 *
 * @example
 * ```typescript
 * const cmp = compareVersions(modelA, modelB);
 * ```
 */
function compareVersions(
  a: Model<Api>,
  b: Model<Api>,
): number {
  const av = extractVersionNumbers(a.id);
  const bv = extractVersionNumbers(b.id);
  const maxLen = Math.max(
    av.length,
    bv.length,
  );
  for (let i = 0; i < maxLen; i++) {
    const diff = (bv[i] ?? 0) - (av[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return av.length - bv.length;
}

/**
 * Find the cheapest models across the top N major version groups,
 * sorted by cost then version.
 *
 * @param models - all models to search (typically filtered to one provider)
 *
 * @param majorVersions - how many major versions to include:
 * 1 = latest only, 2 = latest + previous, 0 = all
 *
 * @returns cheapest models sorted by cost (ascending) then version (descending)
 *
 * @example
 * ```typescript
 * findCheapestInMajorVersions(models, 1); // latest major only
 * ```
 */
function findCheapestInMajorVersions(
  models: Model<Api>[],
  majorVersions: number,
): Model<Api>[] {
  const allVersions = new Set<number>();
  for (const m of models) {
    const ver = extractMajorVersion(m.id);
    if (ver !== null) allVersions.add(ver);
  }
  const sorted = [...allVersions].toSorted(
    function desc(
      a,
      b
    ) { return b - a; },
  );

  if (sorted.length === 0) return [];

  const included = majorVersions === 0
    ? sorted
    : sorted.slice(
      0,
      majorVersions,
    );
  const includedSet = new Set(included);

  const eligible = models.filter(
    function hasVersion(m) {
      const ver = extractMajorVersion(m.id);
      return ver !== null && includedSet.has(ver);
    },
  );

  return eligible.toSorted(
    function byCost(
      a,
      b
    ) {
      const costDiff = a.cost.input - b.cost.input;
      if (costDiff !== 0) return costDiff;
      return compareVersions(
        a,
        b,
      );
    },
  );
}

export {
  compareVersions,
  extractMajorVersion,
  extractVersionNumbers,
  findCheapestInMajorVersions,
};
