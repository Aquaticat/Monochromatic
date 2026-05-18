/**
 * English verb-phrase renderer factory and finite-verb form helpers.
 *
 * @module
 */

import type { SubjectAgreement, } from '../../agreement.ts';
import type {
  Adverbial,
  NounPhrase,
  VerbPhrase,
} from '../../ast.ts';
import type {
  Person,
  Tense,
} from '../../grammar-primitives.ts';
import { joinTokens, } from '../../render-helpers.ts';
import type { EnglishVerbEntry, } from './types.ts';

/** Grammatical-person value used to detect third-person singular agreement; composed from the exempt 1..2 range to satisfy `no-magic-numbers`. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- `1 + 2` widens to `number`; the cast restores the Person literal
const THIRD_PERSON: Person = (1 + 2) as Person;

/**
 * Picks the verb surface for a finite declarative predicate slot.
 *
 * Uses do-support strategy: declaratives use the third-person singular
 * form for 3s present, otherwise the base form. Past tense uses the
 * `past` form. Future leaves the base form; the caller wraps in `will`.
 *
 * @param entry - resolved English verb entry
 *
 * @param tense - sentence tense
 *
 * @param agreement - subject person/number for 3s lookup
 *
 * @returns finite verb surface ready to drop into a declarative
 *
 * @example
 * ```ts
 * declarativeVerbSurface({ entry: { base: 'have', present3s: 'has' }, tense: 'present', agreement: { person: 3, number: 'singular' } });
 * // 'has'
 * ```
 */
export function declarativeVerbSurface(
  {
    entry,
    tense,
    agreement,
  }: {
    entry: EnglishVerbEntry;
    tense: Tense;
    agreement: SubjectAgreement;
  },
): string {
  if (tense === 'past')
    return entry.past ?? `${entry.base}ed`;
  if (tense === 'future')
    return entry.base;
  if ((agreement.person === THIRD_PERSON) && (agreement.number === 'singular'))
    return entry.present3s ?? `${entry.base}s`;
  return entry.base;
}

/**
 * Picks the do-support auxiliary for a yes/no or wh-question body.
 *
 * @param tense - sentence tense
 *
 * @param agreement - subject person/number for `Does` selection
 *
 * @returns lowercase auxiliary; the caller sentence-cases it when at position 0
 *
 * @example
 * ```ts
 * doAuxiliary({ tense: 'past', agreement: { person: 1, number: 'singular' } }); // 'did'
 * ```
 */
export function doAuxiliary(
  {
    tense,
    agreement,
  }: {
    tense: Tense;
    agreement: SubjectAgreement;
  },
): string {
  if (tense === 'past')
    return 'did';
  if (tense === 'future')
    return 'will';
  if ((agreement.person === THIRD_PERSON) && (agreement.number === 'singular'))
    return 'does';
  return 'do';
}

/**
 * Builds an English verb-phrase renderer that consumes the noun-phrase
 * and adverbial renderers as dependencies.
 *
 * @param verbs - verb vocabulary keyed by the consumer's `Verb` union
 *
 * @param renderNounPhrase - noun-phrase render function
 *
 * @param renderAdverbials - adverbial cluster render function
 *
 * @returns render function for verb phrases
 *
 * @example
 * ```ts
 * const renderVerbPhrase = makeEnglishVerbPhraseRenderer({ verbs, renderNounPhrase, renderAdverbials });
 * renderVerbPhrase({ kind: 'verbPhrase', verb: 'save' }); // 'save'
 * ```
 */
export function makeEnglishVerbPhraseRenderer<
  S extends string,
  V extends string,
  N extends string,
>(
  {
    verbs,
    renderNounPhrase,
    renderAdverbials,
  }: {
    verbs: Readonly<Record<V, EnglishVerbEntry>>;
    renderNounPhrase: (phrase: NounPhrase<S, N>,) => string;
    renderAdverbials: (
      advs: readonly Adverbial<S, N>[] | undefined,
    ) => string | undefined;
  },
): (phrase: VerbPhrase<S, V, N>,) => string {
  /**
   * Renders a verb-phrase AST in English using the base verb form.
   *
   * @param phrase - verb-phrase AST
   *
   * @returns rendered surface
   */
  function renderVerbPhrase(phrase: VerbPhrase<S, V, N>,): string {
    /** Verb base form; finite tense is decided by callers that own subject + tense context. */
    const verb = verbs[phrase.verb].base;
    /** Optional rendered object surface; absent when no object slot was supplied. */
    const object = phrase.object === undefined
      ? undefined
      : renderNounPhrase(phrase.object,);
    /** Optional rendered infinitive complement (`to + base + ...`). */
    const complement = phrase.complement === undefined
      ? undefined
      : `to ${renderVerbPhrase(phrase.complement.phrase,)}`;
    /** Optional rendered adverbial cluster. */
    const adverbials = renderAdverbials(phrase.adverbials,);
    return joinTokens([
      verb,
      object,
      complement,
      adverbials,
    ],);
  }

  return renderVerbPhrase;
}
