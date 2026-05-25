/**
 * Shared dependency bundle and slot helpers for the Catalan sentence renderers.
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
import {
  CA_CASE_INVARIANTS,
  type CatalanVerbEntry,
} from './types.ts';

/**
 * Dependency bundle for the Catalan sentence sub-renderers.
 */
export type SentenceDeps<S extends string, V extends string, N extends string,> = {
  readonly subjects: Readonly<Record<S, SubjectEntry>>;
  readonly verbs: Readonly<Record<V, CatalanVerbEntry>>;
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
 * // -> 'la porta' when present, undefined when the object slot is absent
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
 * Renders an optional infinitive complement returning `undefined` when absent.
 *
 * @param complement - optional complement AST
 *
 * @param renderVerbPhrase - verb-phrase render function
 *
 * @returns rendered complement phrase or undefined
 *
 * @example
 * ```ts
 * renderOptionalComplement({ complement: predicate.complement, renderVerbPhrase, },);
 * // -> 'marxar' when present, undefined when the complement slot is absent
 * ```
 */
export function renderOptionalComplement<S extends string, V extends string, N extends string,>(
  {
    complement,
    renderVerbPhrase,
  }: {
    readonly complement: { readonly phrase: VerbPhrase<S, V, N>; } | undefined;
    readonly renderVerbPhrase: (phrase: VerbPhrase<S, V, N>,) => string;
  },
): string | undefined {
  return complement === undefined ? undefined : renderVerbPhrase(complement.phrase,);
}

/**
 * Capitalizes a sentence body using Catalan case-invariants.
 *
 * @param body - rendered body before sentence-case fixup
 *
 * @returns same body with the first character uppercased
 *
 * @example
 * ```ts
 * capitalizeBody('el gat dorm',);
 * // -> 'El gat dorm'
 * ```
 */
export function capitalizeBody(body: string,): string {
  return applyCapitalization({
    text: body,
    mode: 'firstLetter',
    caseInvariants: CA_CASE_INVARIANTS,
  },);
}

/**
 * Maps an English wh-word identifier to the Catalan surface.
 *
 * @param wh - wh-word from the AST
 *
 * @returns Catalan wh-surface
 *
 * @example
 * ```ts
 * catalanWhWord('where',);
 * // -> 'On'
 * ```
 */
export function catalanWhWord(wh: 'where' | 'when' | 'why' | 'how',): string {
  if (wh === 'where')
    return 'On';
  if (wh === 'when')
    return 'Quan';
  if (wh === 'why')
    return 'Per què';
  return 'Com';
}
