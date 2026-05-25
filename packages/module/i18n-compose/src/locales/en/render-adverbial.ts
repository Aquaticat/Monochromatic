/**
 * English adverbial renderer factory.
 *
 * @module
 */

import type {
  Adverbial,
  ExternalText,
  NounPhrase,
} from '../../ast.ts';

/**
 * Builds an English adverbial renderer that consumes already-built noun-phrase rendering.
 *
 * @param renderNounPhrase - noun-phrase render function
 *
 * @returns render function for adverbial clusters; returns `undefined` for empty input
 *
 * @example
 * ```ts
 * const renderAdverbials = makeEnglishAdverbialRenderer({ renderNounPhrase });
 * renderAdverbials([{ kind: 'adverbial.location', relation: 'at', place: { kind: 'noun.bare', noun: 'home' } }]);
 * // 'at home'
 * ```
 */
export function makeEnglishAdverbialRenderer<S extends string, N extends string,>(
  {
    renderNounPhrase,
  }: {
    readonly renderNounPhrase: (phrase: NounPhrase<S, N>,) => string;
  },
): (advs: readonly Adverbial<S, N>[] | undefined,) => string | undefined {
  /**
   * Renders the operand of a `adverbial.time` slot, handling both
   * noun-phrase and opaque external-text variants.
   *
   * @param operand - operand AST node
   *
   * @returns rendered surface
   */
  function renderTimeOperand(operand: NounPhrase<S, N> | ExternalText,): string {
    return operand.kind
      === 'externalText' ? operand.text : renderNounPhrase(operand,);
  }

  /**
   * Renders a single adverbial node.
   *
   * @param adv - adverbial AST node
   *
   * @returns rendered surface
   */
  function renderAdverbial(adv: Adverbial<S, N>,): string {
    if (adv.kind
      === 'adverbial.location')
      return `${adv.relation} ${renderNounPhrase(adv.place,)}`;
    return `${adv.relation} ${renderTimeOperand(adv.time,)}`;
  }

  /**
   * Renders an adverbial cluster as a single space-joined string,
   * returning `undefined` so `joinTokens` can drop the slot.
   *
   * @param advs - optional adverbial list
   *
   * @returns space-joined surface, or undefined for empty input
   */
  function renderAdverbials(
    advs: readonly Adverbial<S, N>[] | undefined,
  ): string | undefined {
    if ((advs === undefined) || (advs.length
      === 0))
      return undefined;
    return advs
      .map(function renderOne(adv,): string {
        return renderAdverbial(adv,);
      },)
      .join(' ',);
  }

  return renderAdverbials;
}
