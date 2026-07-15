import { parse, } from './parse.ts';
import type {
  Diagnostic,
  Rule,
} from './types.ts';

/**
 * Parameters for {@link runRules}.
 */
export type RunRulesParams = {
  /**
   * Rules to run, in order.
   */
  readonly rules: readonly Rule[];
  /**
   * Original source under lint.
   */
  readonly source: string;
  /**
   * Whether the source is MDX.
   */
  readonly mdx: boolean;
};

/**
 * Parse the source once and run every rule against the resulting tree,
 * collecting all diagnostics. Each rule receives the shared tree and the
 * original source; diagnostics are concatenated in rule order.
 *
 * @param rules - rules to run, in order
 *
 * @param source - original source under lint
 *
 * @param mdx - whether the source is MDX
 *
 * @returns every diagnostic from every rule
 *
 * @example
 * ```ts
 * runRules({ rules, source, mdx: false });
 * ```
 */
export function runRules({
  rules,
  source,
  mdx,
}: RunRulesParams,): readonly Diagnostic[] {
  /**
   * Tree shared by every rule for this source.
   */
  const tree = parse({
    source,
    mdx,
  },);
  return rules.flatMap(function checkRule(rule: Rule,): readonly Diagnostic[] {
    return rule.check({
      tree,
      source,
      mdx,
    },);
  },);
}
