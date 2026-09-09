//region Community glossary
// THE COMMUNITY'S WORDS, beside the corpus pin (`corpus-source.ts`), by the
// owner's decision of 2026-09-09 (`doc/decision/translation-repair-community-glossary.md`).
// Two pages shipped the community's words wrong where the archive had them
// right: 自切 as "self-harmed by cutting" and "After she began cutting
// herself" where the archive has "attempted self-surgery"; 超天酱 as
// "Choco-chan" and "Chōten-chan" where the archive has "KAngel" of Needy
// Streamer Overload. Nothing in the pipeline told the bench, so nothing
// stopped it regressing a correct rendering twice.
//
// TWO USES. Every sheet that carries the declared names carries the terms an
// entry's source holds (`communityTermLines`, read into the identity context
// by `document-preparation.ts`), so writers and judges alike know the word.
// The sheets where judges compare candidates name each candidate lacking
// every accepted rendering where the source carries the term
// (`communityRenderingsBlock`): evidence to weigh, not a verdict, and how
// the archive's rendering joins every slate. No candidate is barred by it,
// since a rendering inflects and the judges decide.
//
// THE OWNER CURATES IT. A term the archive got wrong is not entered; the
// renderings are the archive's first, then forms the community also uses.

/**
 * One community term and how the community renders it.
 *
 * @example
 * ```ts
 * const term: CommunityTerm = { term: '自切', renderings: ['self-surgery',], why: '...', };
 * ```
 */
export type CommunityTerm = {
  /**
   * Term as the original writes it.
   */
  readonly term: string;

  /**
   * Renderings the community accepts, the archive's first; a candidate
   * carrying any of them, in any casing, carries the word.
   */
  readonly renderings: readonly string[];

  /**
   * One line of why, for the sheet.
   */
  readonly why: string;
};

/**
 * Community terms the pinned corpus carries, curated by the owner.
 */
export const COMMUNITY_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '自切',
    renderings: ['self-surgery',],
    why: 'the community\'s word for gender-affirming surgery performed on oneself; the archive renders it '
      + '"attempted self-surgery", and "self-harm" or "cutting" misreads it',
  },
  {
    term: '超天酱',
    renderings: [
      'KAngel',
      'Needy Streamer Overload',
    ],
    why: 'the community\'s nickname for KAngel, the streamer character of the game Needy Streamer Overload; '
      + 'the archive names the character or the game, never a transliteration',
  },
];

/**
 * One text a judge is shown, by the label the sheet gives it.
 *
 * @example
 * ```ts
 * const candidate: RenderingCandidate = { label: 'CANDIDATE 1', text, };
 * ```
 */
export type RenderingCandidate = {
  /**
   * Label the sheet shows the text under.
   */
  readonly label: string;

  /**
   * Text as the judge sees it.
   */
  readonly text: string;
};

/**
 * Glossary terms a text carries.
 *
 * AN INDEX SCAN PER TERM, since each term is a fixed string and the glossary
 * is short.
 *
 * @param text - original text to read
 *
 * @param glossary - terms to look for; defaults to the corpus glossary
 *
 * @returns Terms present, in glossary order
 *
 * @example
 * ```ts
 * communityTermsIn({ text: '在她自切后', },);
 * ```
 */
export function communityTermsIn(
  {
    text,
    glossary = COMMUNITY_GLOSSARY,
  }: {
    readonly text: string;
    readonly glossary?: readonly CommunityTerm[];
  },
): readonly CommunityTerm[] {
  return glossary.filter(function present(entry,): boolean {
    return text.includes(entry.term,);
  },);
}

/**
 * Quotes every accepted rendering for a sheet line.
 *
 * @param entry - term whose renderings are listed
 *
 * @returns Renderings quoted and comma-joined
 *
 * @example
 * ```ts
 * quotedRenderings({ entry, },);
 * // => '"KAngel", "Needy Streamer Overload"'
 * ```
 */
function quotedRenderings(
  { entry, }: { readonly entry: CommunityTerm; },
): string {
  return entry.renderings
    .map(function quoted(rendering,): string {
      return `"${rendering}"`;
    },)
    .join(', ',);
}

/**
 * Identity-context lines for the terms an entry's source carries, so every
 * sheet that carries the declared names carries the community's words.
 *
 * @param text - whole original document
 *
 * @param glossary - terms to look for; defaults to the corpus glossary
 *
 * @returns Heading and one line per term present, empty when none is
 *
 * @example
 * ```ts
 * const lines = communityTermLines({ text: sourceText, },);
 * ```
 */
export function communityTermLines(
  {
    text,
    glossary = COMMUNITY_GLOSSARY,
  }: {
    readonly text: string;
    readonly glossary?: readonly CommunityTerm[];
  },
): readonly string[] {
  /**
   * Terms this entry carries.
   */
  const present = communityTermsIn({
    text,
    glossary,
  },);
  if (present.length === 0)
    return [];
  return [
    'COMMUNITY TERMS this entry carries, rendered as the archive and the community render them (a rendering may inflect):',
    ...present.map(function toLine(entry,): string {
      return `- ${entry.term}: ${quotedRenderings({ entry, },)} (${entry.why})`;
    },),
  ];
}

/**
 * Whether a text carries any accepted rendering of a term, in any casing.
 *
 * @param text - candidate text
 *
 * @param entry - term whose renderings are looked for
 *
 * @returns Whether one rendering occurs
 *
 * @example
 * ```ts
 * carriesRendering({ text: 'She attempted self-surgery.', entry, },);
 * // => true
 * ```
 */
function carriesRendering(
  {
    text,
    entry,
  }: {
    readonly text: string;
    readonly entry: CommunityTerm;
  },
): boolean {
  /**
   * Candidate lowered once for every rendering.
   */
  const lowered = text.toLowerCase();
  return entry.renderings
    .some(function occurs(rendering,): boolean {
      return lowered.includes(rendering.toLowerCase(),);
    },);
}

/**
 * Names each candidate lacking every accepted rendering of a term the source
 * carries.
 *
 * AN EMPTY CANDIDATE IS SKIPPED: an absent archive rendering carries no word
 * and is not departing from one.
 *
 * @param sourceText - original the candidates render
 *
 * @param candidates - texts the judge is shown, by label
 *
 * @param glossary - terms to look for; defaults to the corpus glossary
 *
 * @returns One line per candidate and term, in candidate then glossary order
 *
 * @example
 * ```ts
 * const departures = communityRenderingDepartures({ sourceText, candidates, },);
 * ```
 */
export function communityRenderingDepartures(
  {
    sourceText,
    candidates,
    glossary = COMMUNITY_GLOSSARY,
  }: {
    readonly sourceText: string;
    readonly candidates: readonly RenderingCandidate[];
    readonly glossary?: readonly CommunityTerm[];
  },
): readonly string[] {
  /**
   * Terms the source carries.
   */
  const present = communityTermsIn({
    text: sourceText,
    glossary,
  },);
  return candidates.flatMap(function departuresOf(candidate,): readonly string[] {
    if (candidate.text === '')
      return [];
    return present
      .filter(function lacking(entry,): boolean {
        return !carriesRendering({
          text: candidate.text,
          entry,
        },);
      },)
      .map(function toLine(entry,): string {
        return `${candidate.label} carries none of the community's renderings of ${entry.term} (${
          quotedRenderings({ entry, },)
        }); the archive renders it so`;
      },);
  },);
}

/**
 * Sheet block naming the departures, for the judge to weigh after the
 * passages.
 *
 * @param sourceText - original the candidates render
 *
 * @param candidates - texts the judge is shown, by label
 *
 * @param glossary - terms to look for; defaults to the corpus glossary
 *
 * @returns Heading, one line per departure, the inflection note and a blank
 * line; empty when no candidate departs
 *
 * @example
 * ```ts
 * const block = communityRenderingsBlock({ sourceText, candidates, },);
 * ```
 */
export function communityRenderingsBlock(
  {
    sourceText,
    candidates,
    glossary = COMMUNITY_GLOSSARY,
  }: {
    readonly sourceText: string;
    readonly candidates: readonly RenderingCandidate[];
    readonly glossary?: readonly CommunityTerm[];
  },
): readonly string[] {
  /**
   * Departures to name.
   */
  const departures = communityRenderingDepartures({
    sourceText,
    candidates,
    glossary,
  },);
  if (departures.length === 0)
    return [];
  return [
    'COMMUNITY RENDERINGS, evidence to weigh, not a verdict:',
    ...departures.map(function toItem(line,): string {
      return `- ${line}`;
    },),
    'A rendering may inflect; a candidate that renders the term another way departs from the community\'s word.',
    '',
  ];
}

//endregion Community glossary
