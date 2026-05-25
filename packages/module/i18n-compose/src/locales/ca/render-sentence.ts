/**
 * Catalan sentence renderer factory: declarative, yes/no, wh, imperative.
 *
 * @module
 */

import {
  subjectAgreement,
  subjectSurface,
  WH_SUBJECT_AGREEMENT,
} from '../../agreement.ts';
import type {
  Adverbial,
  NounPhrase,
  Sentence,
  VerbPhrase,
  WhQuestion,
} from '../../ast.ts';
import type { SubjectEntry, } from '../../entries.ts';
import {
  applyCapitalization,
  joinTokens,
} from '../../render-helpers.ts';
import { finiteVerbSurface, } from './render-vp.ts';
import {
  CA_CASE_INVARIANTS,
  type CatalanVerbEntry,
} from './types.ts';

/**
 * Dependency bundle for {@link makeCatalanSentenceRenderer}.
 */
type SentenceDeps<S extends string, V extends string, N extends string,> = {
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
 */
function renderOptionalObject<S extends string, N extends string,>(
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
 */
function renderOptionalComplement<S extends string, V extends string, N extends string,>(
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
 */
function capitalizeBody(body: string,): string {
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
 */
function catalanWhWord(wh: 'where' | 'when' | 'why' | 'how',): string {
  if (wh === 'where')
    return 'On';
  if (wh === 'when')
    return 'Quan';
  if (wh === 'why')
    return 'Per què';
  return 'Com';
}

/**
 * Builds a Catalan sentence renderer.
 *
 * @param deps - dependencies (subjects, verbs, sub-renderers)
 *
 * @returns render function for sentences
 *
 * @example
 * ```ts
 * const renderSentence = makeCatalanSentenceRenderer({ subjects, verbs, renderNounPhrase, renderVerbPhrase, renderAdverbials });
 * ```
 */
export function makeCatalanSentenceRenderer<
  S extends string,
  V extends string,
  N extends string,
>(
  deps: SentenceDeps<S, V, N>,
): (sentence: Sentence<S, V, N>,) => string {
  /** Destructured locale dependencies captured for use across every sub-renderer below. */
  const {
    subjects,
    verbs,
    renderNounPhrase,
    renderVerbPhrase,
    renderAdverbials,
  } = deps;

  /**
   * Renders a declarative sentence with sentence-case fixup.
   *
   * @param sentence - declarative AST
   *
   * @returns rendered surface
   */
  function renderDeclarative(
    sentence: Extract<Sentence<S, V, N>, { kind: 'sentence.declarative'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense
      ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Subject surface. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Finite verb surface. */
    const verb = finiteVerbSurface({
      entry: verbs[sentence.predicate
        .verb],
      key: sentence.predicate
        .verb,
      tense,
      agreement,
    },);
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate
        .object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate
        .complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate
      .adverbials,);
    /** Sentence body before sentence-case fixup. */
    const body = joinTokens([
      subj,
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${capitalizeBody(body,)}${sentence.terminator
      ?? '.'}`;
  }

  /**
   * Renders a yes/no question (Catalan v1 uses punctuation alone, no inversion).
   *
   * @param sentence - yes/no AST
   *
   * @returns rendered surface
   */
  function renderYesNo(
    sentence: Extract<Sentence<S, V, N>, { kind: 'sentence.question.yesNo'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense
      ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Subject surface. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Finite verb surface. */
    const verb = finiteVerbSurface({
      entry: verbs[sentence.predicate
        .verb],
      key: sentence.predicate
        .verb,
      tense,
      agreement,
    },);
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate
        .object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate
        .complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate
      .adverbials,);
    /** Sentence body before terminator. */
    const body = joinTokens([
      subj,
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${body}${sentence.terminator
      ?? '?'}`;
  }

  /**
   * Renders a wh-subject question.
   *
   * @param sentence - wh-subject AST
   *
   * @returns rendered surface fronted with `Qui`
   */
  function renderWhSubject(
    sentence: Extract<WhQuestion<S, V, N>, { kind: 'sentence.question.wh.subject'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense
      ?? 'present';
    /** Finite verb surface using wh-subject agreement (3s). */
    const verb = finiteVerbSurface({
      entry: verbs[sentence.predicate
        .verb],
      key: sentence.predicate
        .verb,
      tense,
      agreement: WH_SUBJECT_AGREEMENT,
    },);
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate
        .object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate
        .complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate
      .adverbials,);
    /** Sentence body with `Qui` at head. */
    const body = joinTokens([
      'Qui',
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${body}${sentence.terminator
      ?? '?'}`;
  }

  /**
   * Renders a wh-object question.
   *
   * @param sentence - wh-object AST
   *
   * @returns rendered surface fronted with `Què`
   */
  function renderWhObject(
    sentence: Extract<WhQuestion<S, V, N>, { kind: 'sentence.question.wh.object'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense
      ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Subject surface after the wh-phrase. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Finite verb surface. */
    const verb = finiteVerbSurface({
      entry: verbs[sentence.verb],
      key: sentence.verb,
      tense,
      agreement,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.adverbials,);
    /** Sentence body with `Què` at head. */
    const body = joinTokens([
      'Què',
      verb,
      subj,
      adverbials,
    ],);
    return `${body}${sentence.terminator
      ?? '?'}`;
  }

  /**
   * Renders a wh-adverbial question.
   *
   * @param sentence - wh-adverbial AST
   *
   * @returns rendered surface fronted with the wh-word
   */
  function renderWhAdverbial(
    sentence: Extract<WhQuestion<S, V, N>, { kind: 'sentence.question.wh.adverbial'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense
      ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Subject surface after the wh-phrase. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Finite verb surface. */
    const verb = finiteVerbSurface({
      entry: verbs[sentence.predicate
        .verb],
      key: sentence.predicate
        .verb,
      tense,
      agreement,
    },);
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate
        .object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate
        .complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate
      .adverbials,);
    /** Catalan wh-word matched to the AST relation. */
    const wh = catalanWhWord(sentence.wh,);
    /** Sentence body with wh-word at head. */
    const body = joinTokens([
      wh,
      verb,
      subj,
      object,
      complement,
      adverbials,
    ],);
    return `${body}${sentence.terminator
      ?? '?'}`;
  }

  /**
   * Dispatches a wh-question by slot.
   *
   * @param sentence - wh AST
   *
   * @returns rendered surface
   */
  function renderWh(sentence: WhQuestion<S, V, N>,): string {
    if (sentence.kind
      === 'sentence.question.wh.subject')
      return renderWhSubject(sentence,);
    if (sentence.kind
      === 'sentence.question.wh.object')
      return renderWhObject(sentence,);
    return renderWhAdverbial(sentence,);
  }

  /**
   * Renders an imperative sentence with sentence-case fixup.
   *
   * @param sentence - imperative AST
   *
   * @returns rendered surface
   */
  function renderImperative(
    sentence: Extract<Sentence<S, V, N>, { kind: 'sentence.imperative'; }>,
  ): string {
    /** Imperative surface; falls back to the infinitive when no dedicated form is supplied. */
    const verb = verbs[sentence.predicate.verb]
      .imperative
      ?? verbs[sentence.predicate.verb]
      .infinitive;
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate
        .object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate
        .complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate
      .adverbials,);
    /** Sentence body before sentence-case fixup. */
    const body = joinTokens([
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${capitalizeBody(body,)}${sentence.terminator
      ?? '.'}`;
  }

  /**
   * Dispatches a sentence AST to the correct sub-renderer.
   *
   * @param sentence - sentence AST
   *
   * @returns rendered surface
   */
  function renderSentence(sentence: Sentence<S, V, N>,): string {
    if (sentence.kind
      === 'sentence.declarative')
      return renderDeclarative(sentence,);
    if (sentence.kind
      === 'sentence.question.yesNo')
      return renderYesNo(sentence,);
    if (sentence.kind
      === 'sentence.imperative')
      return renderImperative(sentence,);
    return renderWh(sentence,);
  }

  return renderSentence;
}
