/**
 * English sentence renderer factory: declarative, yes/no, wh, imperative.
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
import {
  declarativeVerbSurface,
  doAuxiliary,
} from './render-vp.ts';
import {
  EN_CASE_INVARIANTS,
  type EnglishVerbEntry,
} from './types.ts';

/**
 * Dependency bundle for {@link makeEnglishSentenceRenderer}.
 */
type SentenceDeps<S extends string, V extends string, N extends string,> = {
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
 */
function renderOptionalObject<S extends string, N extends string,>(
  {
    object,
    renderNounPhrase,
  }: {
    object: NounPhrase<S, N> | undefined;
    renderNounPhrase: (phrase: NounPhrase<S, N>,) => string;
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
 * @returns rendered surface with `to` prefix, or undefined
 */
function renderOptionalComplement<S extends string, V extends string, N extends string,>(
  {
    complement,
    renderVerbPhrase,
  }: {
    complement: { phrase: VerbPhrase<S, V, N>; } | undefined;
    renderVerbPhrase: (phrase: VerbPhrase<S, V, N>,) => string;
  },
): string | undefined {
  return complement === undefined
    ? undefined
    : `to ${renderVerbPhrase(complement.phrase,)}`;
}

/**
 * Capitalizes a sentence body using English case-invariants.
 *
 * @param body - rendered body before sentence-case fixup
 *
 * @returns same body with the first character uppercased unless it is in the invariant set
 */
function capitalizeBody(body: string,): string {
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
 */
function capitalizeWh(wh: string,): string {
  return wh.charAt(0,).toUpperCase() + wh.slice(1,);
}

/**
 * Builds an English sentence renderer.
 *
 * @param deps - per-locale dependencies (subjects, verbs, sub-renderers)
 *
 * @returns render function for sentences
 *
 * @example
 * ```ts
 * const renderSentence = makeEnglishSentenceRenderer({ subjects, verbs, renderNounPhrase, renderVerbPhrase, renderAdverbials });
 * ```
 */
export function makeEnglishSentenceRenderer<
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
   * Renders a declarative sentence.
   *
   * @param sentence - declarative AST
   *
   * @returns rendered surface with sentence-case fixup and terminator
   */
  function renderDeclarative(
    sentence: Extract<Sentence<S, V, N>, { kind: 'sentence.declarative'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense ?? 'present';
    /** Agreement metadata extracted from the subject reference. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Subject surface used in the leading position. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Finite verb surface for this subject + tense. */
    const finite = declarativeVerbSurface({
      entry: verbs[sentence.predicate.verb],
      tense,
      agreement,
    },);
    /** Future tense wraps the base in `will`. */
    const verb = tense === 'future' ? `will ${finite}` : finite;
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate.object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate.complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate.adverbials,);
    /** Sentence body before terminator. */
    const body = joinTokens([
      subj,
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${capitalizeBody(body,)}${sentence.terminator ?? '.'}`;
  }

  /**
   * Renders a yes/no question with do-support.
   *
   * @param sentence - yes/no AST
   *
   * @returns rendered surface with auxiliary, sentence-case fixup, and terminator
   */
  function renderYesNo(
    sentence: Extract<Sentence<S, V, N>, { kind: 'sentence.question.yesNo'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Lowercase auxiliary; sentence-case fixup applied below at position 0. */
    const aux = doAuxiliary({
      tense,
      agreement,
    },);
    /** Subject surface placed after the auxiliary. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Base form of the predicate verb after the auxiliary. */
    const verbBase = verbs[sentence.predicate.verb].base;
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate.object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate.complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate.adverbials,);
    /** Sentence body before sentence-case fixup. */
    const body = joinTokens([
      aux,
      subj,
      verbBase,
      object,
      complement,
      adverbials,
    ],);
    return `${capitalizeBody(body,)}${sentence.terminator ?? '?'}`;
  }

  /**
   * Renders a wh-subject question.
   *
   * @param sentence - wh-subject AST
   *
   * @returns rendered surface fronted with `Who`
   */
  function renderWhSubject(
    sentence: Extract<WhQuestion<S, V, N>, { kind: 'sentence.question.wh.subject'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense ?? 'present';
    /** Wh-subject treated as third-person singular for finite agreement. */
    const finite = declarativeVerbSurface({
      entry: verbs[sentence.predicate.verb],
      tense,
      agreement: WH_SUBJECT_AGREEMENT,
    },);
    /** Future wraps in `will` as in declaratives. */
    const verb = tense === 'future'
      ? `will ${verbs[sentence.predicate.verb].base}`
      : finite;
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate.object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate.complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate.adverbials,);
    /** Sentence body with `Who` at head. */
    const body = joinTokens([
      'Who',
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${body}${sentence.terminator ?? '?'}`;
  }

  /**
   * Renders a wh-object question with do-support.
   *
   * @param sentence - wh-object AST
   *
   * @returns rendered surface fronted with `What`
   */
  function renderWhObject(
    sentence: Extract<WhQuestion<S, V, N>, { kind: 'sentence.question.wh.object'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Lowercase auxiliary placed after the wh-word. */
    const aux = doAuxiliary({
      tense,
      agreement,
    },);
    /** Subject surface placed after the auxiliary. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Base form of the predicate verb after the auxiliary. */
    const verbBase = verbs[sentence.verb].base;
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.adverbials,);
    /** Sentence body with `What` at head. */
    const body = joinTokens([
      'What',
      aux,
      subj,
      verbBase,
      adverbials,
    ],);
    return `${body}${sentence.terminator ?? '?'}`;
  }

  /**
   * Renders a wh-adverbial question (`Where/When/Why/How`).
   *
   * @param sentence - wh-adverbial AST
   *
   * @returns rendered surface fronted with the wh-word
   */
  function renderWhAdverbial(
    sentence: Extract<WhQuestion<S, V, N>, { kind: 'sentence.question.wh.adverbial'; }>,
  ): string {
    /** Sentence-level tense; defaults to present when omitted. */
    const tense = sentence.tense ?? 'present';
    /** Agreement metadata. */
    const agreement = subjectAgreement({
      ref: sentence.subject,
      subjects,
    },);
    /** Lowercase auxiliary placed after the wh-word. */
    const aux = doAuxiliary({
      tense,
      agreement,
    },);
    /** Subject surface placed after the auxiliary. */
    const subj = subjectSurface({
      ref: sentence.subject,
      subjects,
    },);
    /** Base form of the predicate verb after the auxiliary. */
    const verbBase = verbs[sentence.predicate.verb].base;
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate.object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate.complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate.adverbials,);
    /** Wh-word capitalized in the head position. */
    const wh = capitalizeWh(sentence.wh,);
    /** Sentence body with wh-word at head. */
    const body = joinTokens([
      wh,
      aux,
      subj,
      verbBase,
      object,
      complement,
      adverbials,
    ],);
    return `${body}${sentence.terminator ?? '?'}`;
  }

  /**
   * Dispatches a wh-question by slot.
   *
   * @param sentence - wh-question AST
   *
   * @returns rendered surface
   */
  function renderWh(sentence: WhQuestion<S, V, N>,): string {
    if (sentence.kind === 'sentence.question.wh.subject')
      return renderWhSubject(sentence,);
    if (sentence.kind === 'sentence.question.wh.object')
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
    /** Imperative surface, defaulting to `base` when no dedicated form is supplied. */
    const verb = verbs[sentence.predicate.verb].imperative
      ?? verbs[sentence.predicate.verb].base;
    /** Rendered object slot. */
    const object = renderOptionalObject({
      object: sentence.predicate.object,
      renderNounPhrase,
    },);
    /** Rendered infinitive complement. */
    const complement = renderOptionalComplement({
      complement: sentence.predicate.complement,
      renderVerbPhrase,
    },);
    /** Rendered adverbial cluster. */
    const adverbials = renderAdverbials(sentence.predicate.adverbials,);
    /** Sentence body before sentence-case fixup. */
    const body = joinTokens([
      verb,
      object,
      complement,
      adverbials,
    ],);
    return `${capitalizeBody(body,)}${sentence.terminator ?? '.'}`;
  }

  /**
   * Dispatches a sentence AST to the correct sub-renderer.
   *
   * @param sentence - sentence AST
   *
   * @returns rendered surface
   */
  function renderSentence(sentence: Sentence<S, V, N>,): string {
    if (sentence.kind === 'sentence.declarative')
      return renderDeclarative(sentence,);
    if (sentence.kind === 'sentence.question.yesNo')
      return renderYesNo(sentence,);
    if (sentence.kind === 'sentence.imperative')
      return renderImperative(sentence,);
    return renderWh(sentence,);
  }

  return renderSentence;
}
