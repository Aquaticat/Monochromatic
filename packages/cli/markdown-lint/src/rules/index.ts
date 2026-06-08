import type { Rule, } from '../types.ts';
import { noPipeTables, } from './no-pipe-tables.ts';

/**
 * Every rule the linter runs, in execution order. New rules are appended here
 * as they are implemented; the order only affects diagnostic grouping, never
 * correctness, because each rule reads the shared tree independently.
 */
export const rules: readonly Rule[] = [
  noPipeTables,
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
