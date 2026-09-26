/**
 Project replacement for oxlint's `unicorn/no-useless-spread`.

 Upstream removes the spread in `[...x.slice()]` by method name alone, which
 rewrites strings, typed arrays, and iterators into different values (oxc issue
 26159, repo issue 563). This rule keeps every upstream check and its fixes for
 cases syntax proves, asks the TypeScript 7 bridge about ambiguous method
 results, and reports them without a fix when no type is available.

 @module
 */

import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { unwrapExpression, } from '../no-immediate-mutation.syntax.ts';
import { reportUselessClone, } from './clone.ts';
import { reportIterableConsumer, } from './iterable-consumer.ts';
import { reportLiteralSpread, } from './literal-spread.ts';

/**
 Returns the literal's only item when it is a spread element.

 @param literal - Array or object literal.

 @returns Sole spread element, or `undefined`.

 @example
 ```ts
 soleSpread(arrayNode); // spread of [...x]
 ```
 */
function soleSpread(
  literal: ForeignBorrowed<ESTree.ArrayExpression | ESTree.ObjectExpression>,
): ESTree.SpreadElement | undefined {
  /**
   Items of the literal.
   */
  const items = literal.type === 'ArrayExpression' ? literal.elements : literal.properties;
  /**
   First and only item candidate.
   */
  const [only,] = items;
  if ((items.length !== 1) || (only === null) || (only === undefined) || (only.type !== 'SpreadElement'))
    return undefined;
  return only;
}

/**
 Runs every check for one array or object literal, most specific first.

 @param context - Rule context receiving diagnostics.

 @param literal - Literal being visited.

 @example
 ```ts
 checkLiteral({ context, literal: node });
 ```

 @mutates context - Emits diagnostics through the foreign rule context.
 */
function checkLiteral(
  {
    context,
    literal,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly literal: ESTree.ArrayExpression | ESTree.ObjectExpression;
  }>,
): void {
  if (reportLiteralSpread({
    context,
    literal,
  },))
    return;
  /**
   Sole spread element of the literal.
   */
  const spread = soleSpread(literal,);
  if (spread === undefined)
    return;
  if ((literal.type === 'ArrayExpression') && reportIterableConsumer({
    context,
    array: literal,
    spread,
  },))
    return;
  /**
   Spread argument without wrappers; literal arguments were reported as literal spreads.
   */
  const argument = unwrapExpression({ expression: spread.argument, },);
  if ((argument.type === 'ArrayExpression') || (argument.type === 'ObjectExpression'))
    return;
  reportUselessClone({
    context,
    literal,
    spread,
  },);
}

/**
 Disallows spreads that only build a throwaway copy, and ambiguous spreads of
 method results whose meaning depends on a receiver type nobody can see.

 @example
 ```ts
 const copy = [...Array.from(items)]; // reported, fixed to Array.from(items)
 const head = [...text.slice(0, 3)]; // reported without a fix when untyped
 ```
 */
export const noUselessSpread: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Disallow spreads that only copy a fresh value, and ambiguous spreads of method results that no type information explains.',
      recommended: true,
    },
    messages: {
      spreadArrayInArray: 'Spreading an array literal into another array builds a throwaway array; write its elements in place.',
      spreadArrayInArguments: 'Spreading an array literal into an argument list builds a throwaway array; pass the arguments directly.',
      spreadObjectInObject: 'Spreading an object literal into another object builds a throwaway object; write its properties in place.',
      iterableToArray: '`{{consumer}}` accepts any iterable, so converting to an array first only copies; pass the iterable directly.',
      iterableInForOf:
        '`for…of` iterates any iterable, so converting to an array first only copies. Keep the spread only when the loop changes the source and needs a snapshot, and say so in a scoped disable comment.',
      iterableInYieldStar: '`yield*` delegates to any iterable, so converting to an array first only copies; delegate to the iterable directly.',
      cloneArray: '`{{expression}}` already returns a new array, so spreading it into another array only copies it; remove the spread.',
      cloneObject: '`{{expression}}` already returns a new object, so spreading it into another object only copies it; remove the spread.',
      ambiguousConversion:
        'No type information is available here, so `[...{{expression}}]` is ambiguous: `{{method}}` returns a new array on an array, where this spread only copies, but a typed array, string, or iterator on those receivers, where it converts. Say which: remove the spread for an array, use `.values().toArray()` for a typed array, `.toArray()` for an iterator, and a string API or `Intl.Segmenter` for a string.',
    },
  },
  /**
   Creates the literal visitor.

   @param context - Foreign rule context receiving diagnostics.

   @mutates context - Emits diagnostics through the foreign rule context.

   @example
   ```ts
   noUselessSpread.createOnce(context);
   ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return {
      ArrayExpression(node: ForeignBorrowed<ESTree.ArrayExpression>,): void {
        checkLiteral({
          context,
          literal: node,
        },);
      },
      ObjectExpression(node: ForeignBorrowed<ESTree.ObjectExpression>,): void {
        checkLiteral({
          context,
          literal: node,
        },);
      },
    };
  },
};
