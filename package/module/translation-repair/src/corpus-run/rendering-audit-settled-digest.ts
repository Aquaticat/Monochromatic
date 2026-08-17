import { createHash, } from 'node:crypto';

import type {
  AuditedTextIdentity,
  SettledAuditRow,
} from './rendering-audit-settled-row.ts';

//region Audited text identity
// Says whether two audit rows were shown the same characters, without keeping
// the characters.
//
// WHY A DIGEST AND NOT THE TEXT. The corpus is licensed material. It goes to
// the production provider, which is zero-retention, and nowhere else; run files
// are read, grepped, quoted into docs and pasted into issues, so a run file is
// the wrong place for it. The only question a repeat reading asks of the text
// is whether two rows saw the same one, and a digest answers exactly that and
// nothing more.
//
// WHY BOTH SIDES. A repeat is only a repeat when the ORIGINAL and the RENDERING
// both match. Two artifacts of one entry can carry identical source at a slice
// and different English there, which is a comparison of two renderings rather
// than two readings of one, and it belongs in the archive-versus-fresh split
// instead.

/**
 * Marks what the digest is over, so a later change of algorithm or of what is
 * fed to it cannot be mistaken for a text change.
 */
const AUDITED_DIGEST_PREFIX = 'sha256-audited-v1:';

/**
 * Digests the exact pair one audit was shown.
 *
 * @param sourceText - original put in front of the roster
 *
 * @param candidateText - rendering it judged
 *
 * @returns Identity to persist on the row
 *
 * @example
 * ```ts
 * const identity = digestAuditedText({ sourceText, candidateText, },);
 * ```
 */
export function digestAuditedText(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): AuditedTextIdentity {
  return {
    kind: 'digested',
    source: `${AUDITED_DIGEST_PREFIX}${
      createHash('sha256',)
        .update(
          sourceText,
          'utf8',
        )
        .digest('hex',)
    }`,
    candidate: `${AUDITED_DIGEST_PREFIX}${
      createHash('sha256',)
        .update(
          candidateText,
          'utf8',
        )
        .digest('hex',)
    }`,
  };
}

/**
 * Reads a row's text identity, including rows written before it existed.
 *
 * RETURNS `unrecorded` RATHER THAN THROWING. A run persisted before this field
 * was added is a valid run whose other readings are all still answerable; only
 * the repeat readings need it. Refusing to read the file would cost every other
 * reading to serve one.
 *
 * The runtime check is deliberate and not redundant with the type. Rows come
 * off disk, where the type is a claim about what this code writes today rather
 * than about what some older run wrote.
 *
 * @param row - one persisted audit row
 *
 * @returns What it was shown, or a positive statement that nobody recorded it
 *
 * @example
 * ```ts
 * const identity = textIdentityOf({ row, },);
 * ```
 */
export function textIdentityOf(
  { row, }: { readonly row: SettledAuditRow; },
): AuditedTextIdentity {
  /**
   * Field as it came off disk, which older runs do not carry at all.
   */
  const recorded: AuditedTextIdentity | undefined = row.textIdentity;
  if (recorded === undefined)
    return { kind: 'unrecorded', };
  return recorded;
}

/**
 * Whether two rows were shown identical originals and identical renderings.
 *
 * TWO UNRECORDED ROWS ARE NOT A MATCH. This is the whole reason the field is a
 * tagged union: comparing two absences for equality would pair rows by their
 * shared lack of evidence, and every such pair would then be read as one text
 * audited twice.
 *
 * @param left - one row
 *
 * @param right - another
 *
 * @returns Whether both sides are recorded and both agree
 *
 * @example
 * ```ts
 * const same = sameAuditedText({ left, right, },);
 * ```
 */
export function sameAuditedText(
  {
    left,
    right,
  }: {
    readonly left: SettledAuditRow;
    readonly right: SettledAuditRow;
  },
): boolean {
  /**
   * What each was shown.
   */
  const mine = textIdentityOf({ row: left, },);

  /**
   * The other side's.
   */
  const theirs = textIdentityOf({ row: right, },);

  if ((mine.kind === 'unrecorded') || (theirs.kind === 'unrecorded'))
    return false;
  return (mine.source === theirs.source) && (mine.candidate === theirs.candidate);
}

//endregion Audited text identity
