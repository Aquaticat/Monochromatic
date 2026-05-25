import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans union types containing `undefined` (`T | undefined`, `undefined | T`,
 * or `undefined` anywhere in a union).
 *
 * `tsconfig` sets `exactOptionalPropertyTypes: true`. Widening a slot to
 * `T | undefined` skirts that setting instead of fixing the real problem: it
 * lets `undefined` flow into a typed position the optional-property machinery
 * was meant to keep absent. The proper fixes:
 *
 * - Optional property or field: write `foo?: T`, never `foo?: T | undefined`
 *   and never `foo: T | undefined`. Under `exactOptionalPropertyTypes`, `?:`
 *   already means "absent or `T`"; the `| undefined` adds nothing and reopens
 *   the hole the setting closes.
 * - Value that may be missing at runtime: guard with `if` so `undefined` never
 *   flows into the typed slot, or carry an explicit named sentinel value, never
 *   the `| undefined` union.
 *
 * `void` (`TSVoidKeyword`) and `null` (`TSNullKeyword`) are out of scope; only
 * the `undefined` keyword (`TSUndefinedKeyword`) member triggers the rule. A
 * standalone `type X = undefined` is not a union and is not flagged.
 *
 * Genuine external-boundary cases (a parameter mirroring a third-party API type
 * that is itself `T | undefined`) remain handleable with a tightly scoped
 * `oxlint-disable-next-line no-restricted-syntax/no-undefined-union` carrying a
 * justification.
 *
 * @example
 * ```ts
 * // Bad
 * let x: number | undefined;
 * type Opt = { foo?: string | undefined; };
 * function find(): string | undefined {}
 * function take(x: number | undefined): void {}
 * const p: Promise<number | undefined> = load();
 *
 * // Good
 * type Opt = { foo?: string; };
 * const value = lookup(key);
 * if (value === undefined) {
 *   return;
 * }
 * // value is now `T`, never `T | undefined`
 *
 * // Good; explicit named sentinel instead of the union
 * const NOT_FOUND = Symbol('not-found');
 * type Result = string | typeof NOT_FOUND;
 * ```
 */
export const noUndefinedUnion: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow union types containing `undefined` (`T | undefined`). exactOptionalPropertyTypes is on; use `foo?: T`, an if-guard, or a named sentinel instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Union types containing `undefined` are banned (exactOptionalPropertyTypes is on; widening to `T | undefined` skirts it). For an optional property use `foo?: T` (not `foo?: T | undefined` and not `foo: T | undefined`). For a value that may be missing at runtime, guard with `if` so `undefined` never flows into the typed slot, or use an explicit named sentinel. `void` and `null` are out of scope.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      TSUnionType(node: ESTree.TSUnionType,): void {
        // Iterate members directly: a `for...of` loop binding is not a
        // function parameter, so it sidesteps `prefer-readonly-parameter-types`
        // on the `TSType` member without needing an allow-list entry, and
        // avoids a non-capturing nested predicate.
        for (const member of node.types) {
          if (member.type
            === 'TSUndefinedKeyword') {
            context.report({
              node,
              messageId: 'forbidden',
            },);
            return;
          }
        }
      },
    };
  },
};
