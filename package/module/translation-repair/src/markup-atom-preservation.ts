import {
  type MarkupAtom,
  type MarkupAtomKind,
  scanMarkupAtoms,
} from './markup-atom-scan.ts';

//region Markup atom preservation
// What an edit must carry through: every markup atom of the text it replaced,
// less those an addition issue's quote names, since removing the detail an
// addition quotes is the fix (`addition-repair-rule.ts`). Gains are allowed:
// the atoms the replay found edits adding were omission fixes restoring a
// footnote reference, a link destination or a tag (ledger L4).

/**
 Separator between an atom's kind and value in a count key, a character no
 kind name contains.
 */
const KEY_SEPARATOR = '\u0000';

/**
 One carried atom with its place among atoms of the same key.
 */
type RankedAtom = {
  /**
   What the atom is.
   */
  readonly kind: MarkupAtomKind;

  /**
   Its kind-and-value key.
   */
  readonly key: string;

  /**
   How many atoms of the same key the text carried before it.
   */
  readonly rank: number;
};

/**
 Counts atoms by kind and exact value.

 @param atoms - atoms to count

 @returns Count per kind-and-value key

 @example
 ```ts
 const counts = countAtoms({ atoms: scanMarkupAtoms({ text, },), },);
 ```
 */
function countAtoms({ atoms, }: { readonly atoms: readonly MarkupAtom[]; },): ReadonlyMap<string, number> {
  return atoms.reduce(
    function addOne(
      counts,
      atom,
    ) {
    /**
     This atom's key.
     */
    const key = `${atom.kind}${KEY_SEPARATOR}${atom.value}`;
    return counts.set(
      key,
      (counts.get(key,) ?? 0) + 1,
    );
  },
    new Map<string, number>(),
  );
}

/**
 Markup atoms of the replaced text the edit no longer carries and no addition
 issue licensed it to remove.

 @param before - exact text the edit replaced

 @param after - exact text the edit wrote, empty for a deletion

 @param removableQuotes - quotes of the envelope's addition claims, whose
 atoms may go

 @returns Kinds of the atoms lost, one entry per atom, in the order the
 replaced text carried them

 @example
 ```ts
 const lost = lostMarkupAtoms({ before: 'a[^1]', after: 'a', removableQuotes: [], },);
 ```
 */
export function lostMarkupAtoms(
  {
    before,
    after,
    removableQuotes,
  }: {
    readonly before: string;
    readonly after: string;
    readonly removableQuotes: readonly string[];
  },
): readonly MarkupAtomKind[] {
  /**
   Atoms the edit wrote.
   */
  const kept = countAtoms({ atoms: scanMarkupAtoms({ text: after, },), },);

  /**
   Atoms an addition claim quoted, each licensed to go once per quote.
   */
  const licensed = countAtoms({
    atoms: removableQuotes.flatMap(function toAtoms(quote,) {
      return scanMarkupAtoms({ text: quote, },);
    },),
  },);

  /**
   Atoms the replaced text carried, each occurrence paired with how many of
   that key came before it, so a text carrying one twice needs it twice.
   */
  const carried = scanMarkupAtoms({ text: before, },)
    .map(function withRank(
      atom,
      index,
      atoms,
    ): RankedAtom {
      /**
       This atom's key.
       */
      const key = `${atom.kind}${KEY_SEPARATOR}${atom.value}`;
      return {
        kind: atom.kind,
        key,
        rank: atoms.slice(
          0,
          index,
        )
          .filter(function sameKey(earlier,) {
            return `${earlier.kind}${KEY_SEPARATOR}${earlier.value}` === key;
          },)
          .length,
      };
    },);
  return carried
    .filter(function isLost({
      key,
      rank,
    },) {
      return rank >= ((kept.get(key,) ?? 0) + (licensed.get(key,) ?? 0));
    },)
    .map(function toKind({ kind, },) {
      return kind;
    },);
}

//endregion Markup atom preservation
