import { createHash, } from 'node:crypto';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { readFrozenPreparationSelection, } from './read-frozen-preparation-selection.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { MatchedPreparationArtifact, PreparationArtifactInput, PreparationSelectionEvidence, } from './preparation-selection-evidence-model.ts';

//region Frozen supporting-artifact byte ownership

/**
 * Copies raw bytes before hashing so later caller mutation cannot change the matched content.
 * @param content - caller-loaded bytes, never text decoded before hashing
 * @returns Owned byte snapshot
 * @throws PreparationRootError when content is not readable byte-array data
 * @example
 * ```ts
 * const owned = artifactBytes(content);
 * ```
 */
function artifactBytes(content: Readonly<Uint8Array>,): Uint8Array {
  if (!(content instanceof Uint8Array))
    throw new PreparationRootError({ kind: 'reference-content', },);
  try {
    return new Uint8Array(content,);
  }
  catch (error) {
    if (!(error instanceof TypeError))
      throw error;
    throw new PreparationRootError({ kind: 'reference-content', },);
  }
}

/**
 * Matches complete supplied artifact bytes to an independently re-read frozen selection.
 * No path is opened or executed, no semantic role is guessed and no root/phase approval is granted.
 * Callers load bytes at their authorized I/O boundary; this operation owns the matching snapshots.
 *
 * @param text - complete original frozen-selection bytes as text
 * @param expectedDigest - separately recorded selection authority, never a digest derived from this input
 * @param artifacts - explicit caller-loaded raw supporting bytes
 * @param l - caller logger retaining frozen evidence scope
 * @returns Owned exact supporting-byte inventory in original reference order
 * @throws PreparationRootError when selection, inventory or supporting content differs
 * @example
 * ```ts
 * const matched = readPreparationSelectionEvidence({ text, expectedDigest, artifacts, l });
 * ```
 */
export function readPreparationSelectionEvidence({ text, expectedDigest, artifacts, l, }: {
  readonly text: string;
  readonly expectedDigest: string;
  readonly artifacts: readonly PreparationArtifactInput[];
  readonly l: Logger;
},): PreparationSelectionEvidence {
  /** The entry point itself checks independent selection bytes rather than trusting a caller-fabricated typed result. */
  const pl = tagged({ tag: readPreparationSelectionEvidence.name, l, },);
  const selection = readFrozenPreparationSelection({ text, expectedDigest, l: pl, },);
  if ((!Array.isArray(artifacts,)) || (artifacts.length !== selection.references.length))
    throw new PreparationRootError({ kind: 'reference-inventory', },);
  /** Exact frozen locators, not input order or caller-declared hashes, select the records to read. */
  const expectedPaths = new Set(selection.references.map(function path(reference,): string {
    return reference.path;
  },),);
  /** Inventory is checked before any supplied content is copied or hashed. */
  const inputs = new Map<string, PreparationArtifactInput>();
  for (const input of artifacts) {
    if (((typeof input) !== 'object') || (input === null))
      throw new PreparationRootError({ kind: 'reference-inventory', },);
    /** Snapshot locator once so callback-backed descriptors cannot select different keys during this pass. */
    const path = input.path;
    if ((typeof path !== 'string') || (!expectedPaths.has(path,)) || inputs.has(path,))
      throw new PreparationRootError({ kind: 'reference-inventory', },);
    inputs.set(path, input,);
  }
  /** Each independently expected hash is checked against owned raw bytes, without lossy decoding. */
  const matched = selection.references.map(function match(reference,): MatchedPreparationArtifact {
    /** Every expected locator must be present exactly once despite any caller ordering. */
    const input = nonNullishOrThrow(inputs.get(reference.path,),);
    /** Copy precedes the digest and the recorded byte extent. */
    const content = artifactBytes(input.content,);
    /** Raw SHA-256 preserves CRLF, invalid UTF-8 and all other byte distinctions. */
    const digest = createHash('sha256',).update(content,).digest('hex',);
    if (digest !== reference.hash)
      throw new PreparationRootError({ kind: 'reference-content', },);
    return { path: reference.path, hash: reference.hash, bytes: content.byteLength, content, };
  },);
  pl.info(`matched ${String(matched.length,)} frozen supporting artifacts without role or acquisition authority`,);
  return { scope: 'matched-selection-artifacts', selection, artifacts: matched, };
}

//endregion Frozen supporting-artifact byte ownership
