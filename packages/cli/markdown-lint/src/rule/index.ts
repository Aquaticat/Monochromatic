import type { Rule, } from '../types.ts';
import { headingIncrement, } from './md001-heading-increment.ts';
import { commandsShowOutput, } from './md014-commands-show-output.ts';
import { noDuplicateHeading, } from './md024-no-duplicate-heading.ts';
import { singleH1, } from './md025-single-h1.ts';
import { noTrailingPunctuation, } from './md026-no-trailing-punctuation.ts';
import { noBareUrls, } from './md034-no-bare-urls.ts';
import { noEmphasisAsHeading, } from './md036-no-emphasis-as-heading.ts';
import { fencedCodeLanguage, } from './md040-fenced-code-language.ts';
import { referenceDefinitions, } from './md053-reference-definitions.ts';
import { linkImageStyle, } from './md054-link-image-style.ts';
import { noPipeTables, } from './no-pipe-tables.ts';
import { semanticLineBreaks, } from './semantic-line-breaks.ts';

/**
 * Every rule the linter runs, in execution order. New rules are appended here
 * as they are implemented; the order only affects diagnostic grouping, never
 * correctness, because each rule reads the shared tree independently.
 */
export const rules: readonly Rule[] = [
  headingIncrement,
  commandsShowOutput,
  noDuplicateHeading,
  singleH1,
  noTrailingPunctuation,
  noBareUrls,
  noEmphasisAsHeading,
  fencedCodeLanguage,
  referenceDefinitions,
  linkImageStyle,
  noPipeTables,
  semanticLineBreaks,
];

/**
 * Rules keyed by id, for lookups and configuration.
 */
export const rulesById: ReadonlyMap<string, Rule> = new Map(
  rules.map(function entry(rule: Rule,): readonly [
    string,
    Rule,
  ] {
    return [
      rule.id,
      rule,
    ];
  },),
);
