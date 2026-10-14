/**
 Observe native literal rule insertions without matching non-executable source text.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { parse } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import { walkNativeSyntax } from './build-syntax.ts';

//region Original call expressions select exact source spans for instrumentation

/**
 The qualified native builder has this many literal default-rule branches.
 */
const EXPECTED_LITERAL_RULES = 5;

/**
 Rule source transformations keep diagnostics separate from runtime judgments.
 */
const l = tagged({ tag: 'auto-mode-native-build-literal-rules' });

/**
 Replace only original literal rule insertion callees, retaining each literal's original bytes.

 @param source - qualified original builder after the owned insertion helper is added

 @returns source calling the owned observer for each original literal rule insertion

 @throws NativeBatchBuildError when parsing or original literal call membership changes

 @example
 ```ts
 const observedBuilder = rewriteNativeLiteralRules(originalBuilder);
 ```
 */
export function rewriteNativeLiteralRules(source: string): string {
  /**
   Each rewrite logs its own source-qualification boundary.
   */
  const rl = tagged({
    tag: rewriteNativeLiteralRules.name,
    l
  });
  rl.debug('checking original native literal rule insertion calls');
  /**
   Original tokens preserve source order independently of AST child traversal order.
   */
  const parsed = parse(
    source,
    {
      sourceType: 'module',
      tokens: true
    }
  );
  if (parsed.diagnostics
    .length
    > 0) throw new NativeBatchBuildError('Cannot parse native literal-rule source');
  /**
   Callee starts identify disjoint original replacement spans.
   */
  const calls = new Map<number, number>();
  for (const node of walkNativeSyntax(parsed.program)) {
    if ((node.type !== 'ExpressionStatement') || (node.expression
      .type
      !== 'CallExpression')) continue;
    /**
     Only a direct call statement with one literal string argument is a qualified insertion.
     */
    const call = node.expression;
    if (call.optional || (call.callee
      .type
      !== 'Identifier')
      || (call.callee
        .name
        !== 'addRule')
      || (call.arguments
        .length
        !== 1)) continue;
    /**
     Dynamic rule inputs keep their separately instrumented native path.
     */
    const [argument] = call.arguments;
    if ((argument?.type !== 'Literal') || ((typeof argument.value) !== 'string')) continue;
    calls.set(
      call.callee
        .start,
      call.callee
        .end
    );
  }
  if (calls.size !== EXPECTED_LITERAL_RULES) throw new NativeBatchBuildError(`Native literal default-rule branches: expected ${EXPECTED_LITERAL_RULES}, observed ${calls.size}`);
  /**
   Tokens were explicitly requested from the qualified parser.
   */
  const tokens = nonNullishOrThrow(parsed.tokens);
  /**
   Each replacement keeps its original start and end without sorting or accumulated string copies.
   */
  const edits: {
    readonly start: number;
    readonly end: number
  }[] = [];
  for (let index = 0; index < tokens.length; index++) {
    /**
     The token beginning each original callee supplies its source order.
     */
    const start = tokens.start(index);
    /**
     Non-callee tokens have no replacement span.
     */
    const end = calls.get(start);
    if (end !== undefined) edits.push({
      start,
      end
    });
  }
  /**
   Disjoint source fragments copy each untouched code unit once before the final join.
   */
  const fragments = edits.flatMap(function ruleFragments(
    edit,
    index
  ): readonly string[] {
    return [
      source.slice(
        edits[index - 1]
          ?.end
          ?? 0,
        edit.start
      ),
      'addBuiltInRule'
    ];
  });
  fragments.push(source.slice(edits.at(-1)
    ?.end
    ?? 0));
  rl.debug(`instrumented ${edits.length} original literal rule calls`);
  return fragments.join('');
}

//endregion Original call expressions select exact source spans for instrumentation
