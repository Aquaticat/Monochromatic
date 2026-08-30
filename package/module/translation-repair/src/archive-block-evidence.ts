import { archiveContributorNameForms, } from './contributor-name-authority.ts';

//region Archive block evidence

/**
 * Minimum Unicode characters an exact source anchor must carry.
 */
const MINIMUM_SOURCE_QUOTE_CHARACTERS = 4;

/**
 * Translation-side apparatus prefixes accepted only with roster agreement.
 */
const EDITORIAL_PREFIXES: readonly string[] = [
  'contributor:',
  'contributors:',
  'contributors for this entry:',
  'credit:',
  'credits:',
  'source:',
  'sources:',
  'translated by',
  'translation by',
  'translation:',
  'translator:',
];

/**
 * Checks exact source support is substantive and inside expected aligned section.
 *
 * @param sourceContext - expected source section
 *
 * @param sourceQuote - provider's exact support claim
 *
 * @returns Whether quote is long enough and anchored in expected section
 *
 * @example
 * ```ts
 * isArchiveSourceQuoteAnchored({ sourceContext: '猫在窗边睡觉。', sourceQuote: '窗边睡觉', });
 * ```
 */
export function isArchiveSourceQuoteAnchored(
  {
    sourceContext,
    sourceQuote,
  }: {
    readonly sourceContext: string;
    readonly sourceQuote: string;
  },
): boolean {
  /**
   * Quote without accidental boundary whitespace.
   */
  const normalizedQuote = sourceQuote.trim();
  return (normalizedQuote.length >= MINIMUM_SOURCE_QUOTE_CHARACTERS)
    && sourceContext.includes(normalizedQuote,);
}

/**
 * Deterministically corroborates narrow translation-side apparatus category.
 *
 * @param blockText - exact unclaimed archive block
 *
 * @returns Whether block has contributor, citation, media, or comment shape
 *
 * @example
 * ```ts
 * isVerifiableEditorialArchiveBlock({ blockText: 'Translator: Cat Friend', });
 * ```
 */
export function isVerifiableEditorialArchiveBlock(
  { blockText, }: { readonly blockText: string; },
): boolean {
  /**
   * Case-folded visible block used only for fixed apparatus labels.
   */
  const normalized = blockText.trim()
    .toLowerCase();
  if (archiveContributorNameForms({ text: blockText, })
    .length
    > 0)
    return true;
  if (EDITORIAL_PREFIXES.some(function hasPrefix(prefix,): boolean {
    return normalized.startsWith(prefix,);
  },))
    return true;
  if (normalized.startsWith('![',))
    return true;
  return normalized.startsWith('<!--') && normalized.endsWith('-->');
}

//endregion Archive block evidence
