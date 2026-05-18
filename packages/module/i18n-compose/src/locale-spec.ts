/**
 * `LocaleSpec` is the uniform output produced by every locale builder.
 *
 * Builders accept locale-specific vocabulary entry shapes (e.g.
 * `EnglishVerbEntry`) and emit this single shape so `createI18n` can
 * dispatch render calls without knowing which builder produced the spec.
 *
 * @module
 */

import type {
  Fragment,
  NounPhrase,
  Sentence,
  VerbPhrase,
} from './ast.ts';

/**
 * Render-time interface every locale builder produces.
 *
 * Each method takes the same AST shape regardless of locale; the
 * differences live inside the closure the builder captures.
 *
 * The generics flow from the consumer's vocabulary unions so that an
 * AST referencing a noun key the locale spec does not define is rejected
 * at compile time.
 */
export type LocaleSpec<
  Label extends string,
  Subject extends string,
  Verb extends string,
  Noun extends string,
> = {
  /** Resolves a static UI label key to its rendered surface. */
  renderLabel(key: Label,): string;
  /** Resolves a bare noun key to its rendered surface, without any article or count. */
  renderNoun(key: Noun,): string;
  /** Renders a complete noun phrase AST. */
  renderNounPhrase(phrase: NounPhrase<Subject, Noun>,): string;
  /** Renders a complete verb phrase AST, using the locale's tense and agreement strategy. */
  renderVerbPhrase(phrase: VerbPhrase<Subject, Verb, Noun>,): string;
  /** Renders a sentence AST (declarative, yes/no, wh, or imperative). */
  renderSentence(sentence: Sentence<Subject, Verb, Noun>,): string;
  /** Renders a fragment AST (sub-sentence text such as headings or button labels). */
  renderFragment(fragment: Fragment<Label, Subject, Verb, Noun>,): string;
};

/**
 * Extracts the `Label` type parameter from a {@link LocaleSpec}.
 */
export type LabelOf<Spec,> = Spec extends LocaleSpec<infer L, string, string, string> ? L
  : never;

/**
 * Extracts the `Subject` type parameter from a {@link LocaleSpec}.
 */
export type SubjectOf<Spec,> = Spec extends LocaleSpec<string, infer S, string, string>
  ? S
  : never;

/**
 * Extracts the `Verb` type parameter from a {@link LocaleSpec}.
 */
export type VerbOf<Spec,> = Spec extends LocaleSpec<string, string, infer V, string> ? V
  : never;

/**
 * Extracts the `Noun` type parameter from a {@link LocaleSpec}.
 */
export type NounOf<Spec,> = Spec extends LocaleSpec<string, string, string, infer N> ? N
  : never;
