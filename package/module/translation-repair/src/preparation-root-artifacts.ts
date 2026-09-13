import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type {
  PreparationRootReference,
  PreparationRootReferenceBinding,
  PreparationRootReferenceRole,
} from './preparation-root-reference-model.ts';
import type {
  MatchedPreparationArtifact,
  PreparationSelectionEvidence,
} from './preparation-selection-evidence-model.ts';
import { preparationRootRecord, } from './preparation-root-value.ts';

//region Internal semantic reader over fresh owned byte matches

/**
 * Native root ownership interprets checked relationships; unconsumed support remains explicitly opaque.
 *
 * @example
 * ```ts
 * const reader = preparationRootArtifacts({ evidence, l });
 * ```
 */
export type PreparationRootArtifacts = {
  /**
   * First registered task40 document is the historical policy population, not current execution authority.
   */
  readonly pool: Readonly<Record<string, unknown>>;
  /**
   * Current reading journal owns frame and note references.
   */
  readonly journal: Readonly<Record<string, unknown>>;
  /**
   * Carried readings must remain anchored to this exact prior journal.
   */
  readonly priorJournal: Readonly<Record<string, unknown>>;
  /**
   * Exact prior-journal identity is checked separately from its parsed contents.
   */
  readonly priorJournalHash: string;
  /**
   * Checks one complete entry frame against current text without executing its locator.
   */
  readonly frame: (input: {
    readonly file: string;
    readonly hash: string;
    readonly consumer: string;
    readonly expectedText: string
  }) => void;
  /**
   * Returns an owned parsed note only after the journal's path/hash relationship matches.
   */
  readonly note: (input: {
    readonly path: string;
    readonly hash: string;
    readonly consumer: string
  }) => Readonly<Record<string, unknown>>;
  /**
   * Produces the complete original inventory with no byte buffers or executable meaning.
   */
  readonly references: () => readonly PreparationRootReference[];
};

/**
 * Interprets only fresh byte-matched artifacts created inside the owning root operation.
 * This internal function is not a public alternative to independently checking the original selection bytes.
 *
 * @param evidence - owning entry point's new byte-match result, never a retained mutable certificate
 *
 * @param l - caller logger retaining semantic input scope
 *
 * @returns Internal relationship checks and a complete attributed reference projection
 *
 * @throws PreparationRootError when a relationship, UTF-8 document or JSON shape differs
 *
 * @example
 * ```ts
 * const reader = preparationRootArtifacts({ evidence, l });
 * ```
 */
export function preparationRootArtifacts({
  evidence,
  l,
}: {
  readonly evidence: PreparationSelectionEvidence;
  readonly l: Logger;
},): PreparationRootArtifacts {
  /**
   * No locator is opened and no historical source file is executed.
   */
  const pl = tagged({
    tag: preparationRootArtifacts.name,
    l,
  },);
  /**
   * Original ordering is part of the supported frozen producer format.
   */
  const [pool, journal, priorJournal,] = evidence.artifacts;
  if ((pool === undefined) || (journal === undefined)
    || (priorJournal === undefined))
    throw new PreparationRootError({ kind: 'reference-role', },);
  /**
   * The byte matcher already established exact unique path membership.
   */
  const byPath = new Map(evidence.artifacts
    .map(function keyed(artifact,): readonly [
      string,
      MatchedPreparationArtifact
    ] { return [
      artifact.path,
      artifact,
    ]; },),);
  /**
   * Mutable attribution remains private to this one root operation.
   */
  const bindings = new Map<string, PreparationRootReferenceBinding[]>();

  /**
   * Retains one checked semantic relationship without merging entry and parent authority.
   *
   * @param artifact - already matched bytes owning this relationship
   *
   * @param role - fixed interpreted use
   *
   * @param consumer - named entry, parent or selection
   *
   * @example
   * ```ts
   * attribute({ artifact, role: 'reading-note', consumer: parentId });
   * ```
   */
  function attribute({
    artifact,
    role,
    consumer,
  }: {
    readonly artifact: MatchedPreparationArtifact;
    readonly role: PreparationRootReferenceRole;
    readonly consumer: string
  },): void {
    /**
     * Repeated access does not fabricate additional provenance relationships.
     */
    const existing = bindings.get(artifact.path,) ?? [];
    if (existing.some(function duplicate(binding,): boolean { return (binding.role === role) && (binding.consumer === consumer); },))
      return;
    bindings.set(
      artifact.path,
      [
        ...existing,
        {
          role,
          consumer,
        },
      ],
    );
  }

  /**
   * Decodes only role-bearing documents; opaque support is never interpreted.
   *
   * @param artifact - fresh owned matching bytes
   *
   * @returns Exact UTF-8 text without newline normalization
   *
   * @throws PreparationRootError when UTF-8 decoding fails
   *
   * @example
   * ```ts
   * const text = textOf(artifact);
   * ```
   */
  function textOf(artifact: MatchedPreparationArtifact,): string {
    try {
      return new TextDecoder(
        'utf-8',
        { fatal: true, },
      ).decode(artifact.content,);
    }
    catch (error) {
      if (!(error instanceof TypeError))
        throw error;
      pl.warn('registered semantic document is not valid UTF-8; decoder details were not retained',);
      throw new PreparationRootError({
        kind: 'reference-role',
        input: artifact.path,
      },);
    }
  }

  /**
   * Parses one document without retaining native excerpts in a failure cause.
   *
   * @param artifact - current role-bearing bytes
   *
   * @returns Owned read-only JSON record
   *
   * @throws PreparationRootError when JSON or record shape is invalid
   *
   * @example
   * ```ts
   * const note = jsonOf(artifact);
   * ```
   */
  function jsonOf(artifact: MatchedPreparationArtifact,): Readonly<Record<string, unknown>> {
    try {
      return preparationRootRecord(
        JSON.parse(textOf(artifact,),),
      );
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      pl.warn('registered semantic document is not valid JSON; parser details were not retained',);
      throw new PreparationRootError({
        kind: 'reference-role',
        input: artifact.path,
      },);
    }
  }

  /**
   * Checks the exact complete-entry frame through its journal hash and filename, never a guessed directory.
   *
   * @param file - journal's original frame filename
   *
   * @param hash - independently bound journal claim
   *
   * @param consumer - entry whose complete text is being checked
   *
   * @param expectedText - frame rebuilt from current pinned entry and parent positions
   *
   * @throws PreparationRootError when the frame is ambiguous, absent or different
   *
   * @example
   * ```ts
   * frame({ file, hash, consumer: entryId, expectedText });
   * ```
   */
  function frame({
    file,
    hash,
    consumer,
    expectedText,
  }: {
    readonly file: string;
    readonly hash: string;
    readonly consumer: string;
    readonly expectedText: string
  },): void {
    /**
     * Both the journal's exact byte identity and its filename must select one original artifact.
     */
    const candidates = evidence.artifacts
      .filter(function matching(artifact,): boolean {
      return (artifact.hash === hash) && (artifact.path
        .slice(artifact.path
          .lastIndexOf('/',)
          + 1,)
        === file);
    },);
    /**
     * Ambiguity cannot be resolved by choosing the first matching artifact.
     */
    const [artifact,] = candidates;
    if ((candidates.length !== 1) || (artifact === undefined)
      || (textOf(artifact,) !== expectedText))
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: consumer,
      },);
    attribute({
      artifact,
      role: 'complete-entry-reading-frame',
      consumer,
    },);
  }

  /**
   * Resolves a note only through a byte-bound journal relationship.
   *
   * @param path - exact frozen locator named by the journal
   *
   * @param hash - journal's expected supporting-byte identity
   *
   * @param consumer - entry or parent owning this read
   *
   * @returns Parsed note with no execution or qualification authority
   *
   * @throws PreparationRootError when the path/hash relationship differs
   *
   * @example
   * ```ts
   * const note = noteOf({ path, hash, consumer: parentId });
   * ```
   */
  function noteOf({
    path,
    hash,
    consumer,
  }: {
    readonly path: string;
    readonly hash: string;
    readonly consumer: string
  },): Readonly<Record<string, unknown>> {
    /**
     * Caller labels cannot substitute a different registered artifact.
     */
    const artifact = byPath.get(path,);
    if ((artifact === undefined) || (artifact.hash !== hash))
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: consumer,
      },);
    /**
     * JSON is parsed before the relationship is returned to a reader.
     */
    const record = jsonOf(artifact,);
    attribute({
      artifact,
      role: 'reading-note',
      consumer,
    },);
    return record;
  }

  /**
   * Projects complete ownership while keeping unconsumed support opaque.
   *
   * @returns Original ordered references with owned relationship records
   *
   * @example
   * ```ts
   * const references = referencesOf();
   * ```
   */
  function referencesOf(): readonly PreparationRootReference[] {
    return evidence.artifacts
      .map(function reference(artifact,): PreparationRootReference {
      return {
        path: artifact.path,
        hash: artifact.hash,
        bytes: artifact.bytes,
        bindings: (bindings.get(artifact.path,) ?? [{
          role: 'opaque-selection-support',
          consumer: 'selection',
        },]).map(function owned(binding,): PreparationRootReferenceBinding { return { ...binding, }; },),
      };
    },);
  }

  attribute({
    artifact: pool,
    role: 'policy-pool',
    consumer: 'selection',
  },);
  attribute({
    artifact: journal,
    role: 'reading-journal',
    consumer: 'selection',
  },);
  attribute({
    artifact: priorJournal,
    role: 'prior-reading-journal',
    consumer: 'selection',
  },);
  return {
    pool: jsonOf(pool,),
    journal: jsonOf(journal,),
    priorJournal: jsonOf(priorJournal,),
    priorJournalHash: priorJournal.hash,
    frame,
    note: noteOf,
    references: referencesOf,
  };
}

//endregion Internal semantic reader over fresh owned byte matches
