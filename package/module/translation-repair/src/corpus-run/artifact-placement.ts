import {
  readdir,
  readFile,
} from 'node:fs/promises';

import { isDigestShaped, } from './pipeline-digest.ts';

//region Artifact placement
// How ONE settled artifact answers "which pipeline produced you".
//
// Split from the census when generation identity moved from the recorded commit
// to the digest of the built output: placing one file became a question with
// four answers rather than two, and the census had no room left for it. The
// census aggregates; this decides.

/**
 * Characters in a SHA-1 object id, the shorter of the two git uses.
 */
const SHA1_LENGTH = 40;

/**
 * Characters in a SHA-256 object id, for repositories using that hash.
 */
const SHA256_LENGTH = 64;

/**
 * Whether a recorded tip is a canonical full object id.
 *
 * A nonempty string was the whole test before, which accepted ` `, `HEAD`,
 * `main` and any revision expression. Those are not identities: `HEAD` in a
 * settled artifact resolves against the READER's checkout at read time rather
 * than against whatever produced the artifact, so it silently answers a
 * different question than the one asked, and a branch name answers a question
 * whose answer changes.
 *
 * Scanned rather than matched with a pattern: the rule is one predicate per
 * character over a fixed-length string, which is a linear pass that cannot
 * backtrack, and the codebase forbids a regex where an index scan says the
 * same thing.
 *
 * @param value - tip as the artifact recorded it
 *
 * @returns Whether it is 40 or 64 lowercase hex characters
 *
 * @example
 * ```ts
 * const usable = isObjectId({ value: 'a41fc607ea5a70d8a7625cc67d5ed8c444f53379', },);
 * ```
 */
function isObjectId({ value, }: { readonly value: string; },): boolean {
  if ((value.length !== SHA1_LENGTH) && (value.length !== SHA256_LENGTH))
    return false;

  for (const character of value) {
    /**
     * Whether it is one of `0` to `9`.
     */
    const isDigit = (character >= '0') && (character <= '9');

    /**
     * Whether it is one of `a` to `f`. Uppercase is refused deliberately: git
     * writes lowercase, so an uppercase id came from somewhere else, and two
     * spellings of one commit would count as two generations.
     */
    const isLowerHex = (character >= 'a') && (character <= 'f');

    if ((!isDigit) && (!isLowerHex))
      return false;
  }

  return true;
}

/**
 * How one artifact places into a generation.
 *
 * @example
 * ```ts
 * const placement: Placement = { kind: 'pre-digest', tip, };
 * ```
 */
export type Placement =
  | Readonly<{
    /**
     * Artifact records both what ran and where it came from.
     */
    kind: 'placed';

    /**
     * Repo commit its pass started under.
     */
    tip: string;

    /**
     * Built output its pass executed, which is the generation.
     */
    digest: string;
  }>
  | Readonly<{
    /**
     * Artifact records a usable commit but no digest, so it was settled before
     * generation identity existed.
     *
     * Kept apart from `untagged` because the remedy differs: an untagged file
     * is deleted, while these are perfectly good results of a pipeline nobody
     * can name any more, and the remedy is a fresh directory.
     */
    kind: 'pre-digest';

    /**
     * Repo commit its pass started under, all the provenance it has.
     */
    tip: string;
  }>
  | Readonly<{
    /**
     * Artifact would not parse at all.
     */
    kind: 'malformed';
  }>
  | Readonly<{
    /**
     * Artifact parsed but recorded nothing that could identify it.
     */
    kind: 'untagged';
  }>;

/**
 * Lists the REGULAR FILES of an artifacts directory.
 *
 * Directory entries are checked rather than assumed. A directory named
 * `backup.json` otherwise reached `readFile` and threw EISDIR out of the whole
 * census, and a symlink was followed wherever it pointed, which could duplicate
 * another artifact under a second identity or leave the directory entirely.
 * Neither is an artifact, and neither should cost more than being skipped.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Names of regular files only, unsorted
 *
 * @example
 * ```ts
 * const names = await readdirArtifacts({ artifactsDir, },);
 * ```
 */
export async function readdirArtifacts(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<readonly string[]> {
  return (await readdir(
    artifactsDir,
    { withFileTypes: true, },
  ))
    .filter(function isRegularFile(entry,): boolean {
      return entry.isFile();
    },)
    .map(function toName(entry,): string {
      return entry.name;
    },);
}

/**
 * Reads which pipeline one artifact records.
 *
 * Reports rather than throws, because this package already decided a corrupt
 * artifact costs its own row and not the whole run. The failure kinds stay
 * distinct because they are handled oppositely: a malformed file belongs to the
 * reader that reports malformed files, an untagged one belongs nowhere, and a
 * pre-digest one is a fine result whose pipeline can no longer be named.
 *
 * @param artifactsDir - directory holding the artifact
 *
 * @param name - artifact file name
 *
 * @returns How this artifact places
 *
 * @example
 * ```ts
 * const placement = await readPlacement({ artifactsDir, name: 'Acheron.json', },);
 * ```
 */
export async function readPlacement(
  {
    artifactsDir,
    name,
  }: {
    readonly artifactsDir: string;
    readonly name: string;
  },
): Promise<Placement> {
  /**
   * Entry id the pool will key this artifact by, which is its file name.
   */
  const keyedId = name.slice(
    0,
    -'.json'.length,
  );

  if (keyedId === '')
    return { kind: 'untagged', };

  try {
    // INSIDE the try, deliberately. It used to sit outside, so a vanished
    // file, an unreadable one, or a directory named `something.json` threw
    // out of the whole census instead of costing its own row. That is the
    // opposite of this module's stated policy, and it aborts a pass at
    // startup now that the resume guard runs the census.
    /**
     * Raw artifact text.
     */
    const text = await readFile(
      `${artifactsDir}/${name}`,
      'utf8',
    );

    /**
     * Artifact as parsed JSON.
     */
    const parsed: unknown = JSON.parse(text,);

    if (((typeof parsed) !== 'object') || (parsed === null))
      return { kind: 'untagged', };

    // The file name is what the pool keys on and what the scheduler calls
    // settled, while every reader downstream uses the id INSIDE. Unequal means
    // one artifact would be admitted under one identity and read under
    // another, which is how `Mittens-copy.json` becomes a second settled entry
    // and `Mittens.json.json` becomes an entry called `Mittens.json`.
    // Presence is required, not merely agreement. Guarding the comparison with
    // `'id' in parsed` meant an artifact carrying no id at all skipped the
    // check entirely and was placed on its file name alone, which is the one
    // reading the check exists to refuse: the pool would admit it under a name
    // the bytes never claimed.
    /**
     * Entry id these bytes claim, absent when they claim none.
     */
    const recordedId: unknown = ('id' in parsed) ? parsed.id : undefined;

    if (recordedId !== keyedId) {
      console.log(
        `POOL ${name} records id ${
          recordedId === undefined ? '(absent)' : JSON.stringify(recordedId,)
        }, which is not its file name; treating it as unplaceable`,
      );
      return { kind: 'untagged', };
    }

    if (!('tip' in parsed))
      return { kind: 'untagged', };

    /**
     * Commit as the artifact recorded it.
     */
    const { tip, } = parsed;

    if (((typeof tip) !== 'string') || (!isObjectId({ value: tip, },)))
      return { kind: 'untagged', };

    if (!('pipelineDigest' in parsed))
      return {
        kind: 'pre-digest',
        tip,
      };

    /**
     * Built output as the artifact recorded it.
     */
    const { pipelineDigest, } = parsed;

    // A digest that is present and unusable is not the same as one that is
    // absent. Absent means old; malformed means something wrote a field this
    // package owns, and pooling on it would pool on a value nothing produced.
    if (
      ((typeof pipelineDigest) !== 'string')
      || (!isDigestShaped({ value: pipelineDigest, },))
    ) {
      console.log(
        `POOL ${name} records an unusable pipeline digest; treating it as `
          + 'unplaceable',
      );
      return { kind: 'untagged', };
    }

    return {
      kind: 'placed',
      tip,
      digest: pipelineDigest,
    };
  }
  catch (error) {
    // A truncated artifact is an ordinary outcome of a pass killed at its hard
    // cap, and so, now that the read happens here, is a file that vanished or
    // could not be opened. Logged rather than swallowed so a systematic write
    // fault is visible instead of showing up as a quietly smaller pool.
    console.log(
      `POOL malformed ${name}: ${String(error,)}`,
    );
    return { kind: 'malformed', };
  }
}

//endregion Artifact placement
