/**
 * Shared dependency bundle and slot helpers for the English sentence renderers.
 *
 * @module
 */

import type {
  Adverbial,
  NounPhrase,
  VerbPhrase,
} from '../../ast.ts';
import type { SubjectEntry, } from '../../entries.ts';
import { applyCapitalization, } from '../../render-helpers.ts';
import type { EnglishComplementForm, } from './render-vp.ts';
import {
  EN_CASE_INVARIANTS,
  type EnglishVerbEntry,
} from './types.ts';

/**
 * Dependency bundle for the English sentence sub-renderers.
 */
export type SentenceDeps<S extends string, V extends string, N extends string,> = {
  readonly subjects: Readonly<Record<S, SubjectEntry>>;
  readonly verbs: Readonly<Record<V, EnglishVerbEntry>>;
  readonly renderNounPhrase: (phrase: NounPhrase<S, N>,) => string;
  readonly renderVerbPhrase: (phrase: VerbPhrase<S, V, N>,) => string;
  readonly renderAdverbials: (
    advs: readonly Adverbial<S, N>[] | undefined,
  ) => string | undefined;
};

/**
 * Renders an optional object slot, returning `undefined` when absent.
 *
 * @param object - optional object AST
 *
 * @param renderNounPhrase - noun-phrase render function
 *
 * @returns rendered surface or undefined
 *
 * @example
 * ```ts
 * renderOptionalObject({ object: predicate.object, renderNounPhrase, },);
 * // -> 'the door' when present, undefined when the object slot is absent
 * ```
 */
export function renderOptionalObject<S extends string, N extends string,>(
  {
    object,
    renderNounPhrase,
  }: {
    readonly object: NounPhrase<S, N> | undefined;
    readonly renderNounPhrase: (phrase: NounPhrase<S, N>,) => string;
  },
): string | undefined {
  return object === undefined ? undefined : renderNounPhrase(object,);
}

/**
 * Renders an optional infinitive complement (`to + ...`) returning `undefined` when absent.
 *
 * @param complement - optional complement AST
 *
 * @param renderVerbPhrase - verb-phrase render function
 *
 * @param form - complement attachment mode for the predicate head
 *
 * @returns rendered surface with `to` prefix, bare surface, or undefined
 *
 * @example
 * ```ts
 * renderOptionalComplement({ complement: predicate.complement, renderVerbPhrase, form: 'to', },);
 * // -> 'to leave' for the infinitive form, 'leave' for the bare form
 * ```
 */
export function renderOptionalComplement<S extends string, V extends string, N extends string,>(
  {
    complement,
    renderVerbPhrase,
    form,
  }: {
    readonly complement: { readonly phrase: VerbPhrase<S, V, N>; } | undefined;
    readonly renderVerbPhrase: (phrase: VerbPhrase<S, V, N>,) => string;
    readonly form: EnglishComplementForm;
  },
): string | undefined {
  if (complement === undefined)
    return undefined;
  /** Rendered nested verb phrase before complement marker selection. */
  const rendered = renderVerbPhrase(complement.phrase,);
  return form === 'bare' ? rendered : `to ${rendered}`;
}

/**
 * Capitalizes a sentence body using English case-invariants.
 *
 * @param body - rendered body before sentence-case fixup
 *
 * @returns same body with the first character uppercased unless it is in the invariant set
 *
 * @example
 * ```ts
 * capitalizeBody('the cat sleeps',);
 * // -> 'The cat sleeps'
 * ```
 */
export function capitalizeBody(body: string,): string {
  return applyCapitalization({
    text: body,
    mode: 'firstLetter',
    caseInvariants: EN_CASE_INVARIANTS,
  },);
}

/**
 * Capitalizes a wh-word for the head position.
 *
 * @param wh - wh-word lowercase form
 *
 * @returns wh-word with the first character uppercased
 *
 * @example
 * ```ts
 * capitalizeWh('where',);
 * // -> 'Where'
 * ```
 */
export function capitalizeWh(wh: string,): string {
  return wh.charAt(0,)
    .toUpperCase()
    + wh
    .slice(1,);
}
