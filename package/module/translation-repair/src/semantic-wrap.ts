import {
  fixSource,
  type Rule,
  rulesById,
} from '@monochromatic-dev/cli-markdown-lint/ts';

//region Semantic wrap
// PUTS THE LINE BREAKS BACK that a model does not emit.
//
// A model returns a passage as one long line, or as whatever wrapping it felt
// like. Measured over the pool settled 2026-08-18, 58 of 64 shipped passages
// carried at least one `semantic-line-breaks` finding, 326 findings in all, and
// 17 of them flattened a multi-line archive passage to a single line. The
// grader called this out unprompted at two separate items and stated the policy
// behind it: semantic wrapping is paramount for maintainability, whether or not
// the Chinese original had it. `MD1` says the same thing.
//
// THE RULE IS THIS REPOSITORY'S OWN, and it is chosen rather than reimplemented
// for one property: it only ever ADDS BREAKS. It turns the space after a
// break-point character that ends a written word into a newline plus the
// block's continuation prefix, and it never joins, moves or removes a break. So
// it cannot destroy a break a model got right, which is what makes running it
// over every shipped passage safe without inspecting them first.
//
// THE SPACE WAS ONCE LEFT IN PLACE, which opened every inserted continuation
// with a stray one: `>  text` inside a blockquote, and a three-space indent
// under a `- ` marker. Passages settled before 2026-08-20 carry that shape, and
// the rule leaves it exactly as it is rather than re-wrapping it, which is what
// keeps a cache replay from returning text no lane produced.
//
// MEASURED BEFORE IT WAS WIRED IN, over all 64 shipped passages of that pool:
// findings go from 326 to 0, no passage loses a non-newline character, the ten
// that gain characters gain continuation prefixes inside blockquotes and lists,
// and a second application changes nothing. `~/temp/agent/wrap-probe-2.mjs`,
// written up in `doc/audit/line-structure-loss-when-a-replacement-ships.md`.
//
// IDEMPOTENCE IS WHAT LETS THIS RUN ON A CACHE REPLAY. A resumed slice is
// wrapped on the way out of the cache rather than on the way in, so a pool
// holding entries written before this existed needs no migration and no key
// change, and a slice that was already wrapped is left exactly as it was.

/**
 * Rule this applies, named by the id its own registry keys it under.
 */
const RULE_ID = 'semantic-line-breaks';

/**
 * The one rule, resolved once at module load.
 */
const RULE = rulesById.get(RULE_ID,);

// AT LOAD RATHER THAN PER CALL, so a rename in the linter package fails the
// first import with a message naming the rule, instead of failing a slice
// halfway through a run that has already been paid for.
if (RULE === undefined)
  throw new Error(
    `markdown-lint no longer carries \`${RULE_ID}\`, so shipped text cannot be wrapped at its semantic boundaries`,
  );

/**
 * That rule as the fixer takes its roster.
 */
const WRAP_RULES: readonly Rule[] = [RULE,];

/**
 * Wraps one passage at its semantic boundaries.
 *
 * NEVER APPLIED TO TEXT A LANE DECIDED TO KEEP. Wrapping a retained passage
 * would turn a decision to change nothing into a change, which the delivery
 * coherence check and the assembly assertion both refuse by design, and it
 * would also manufacture the one kind of edit a human grader cannot usefully
 * judge. Callers pass only wording a lane produced.
 *
 * @param text - passage as the lane produced it
 *
 * @returns Same passage with semantic line breaks inserted
 *
 * @example
 * ```ts
 * const wrapped = wrapReplacementText({ text: 'It naps. It wakes.', },);
 * ```
 */
export function wrapReplacementText({ text, }: { readonly text: string; },): string {
  return fixSource({
    rules: WRAP_RULES,
    source: text,
    mdx: false,
  },)
    .source;
}

//endregion Semantic wrap
