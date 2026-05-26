import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * AST `type` names of the two banned nullish keyword members: `undefined`
 * (`TSUndefinedKeyword`) and `null` (`TSNullKeyword`). A `Set` keeps the
 * membership test a single call, sidestepping a mixed-operator `||` chain.
 * `TSNullKeyword` is the `null` type keyword, distinct from the `null` literal
 * node `TSNullLiteral`.
 */
const NULLISH_KEYWORD_TYPES: ReadonlySet<string> = new Set([
  'TSUndefinedKeyword',
  'TSNullKeyword',
],);

/**
 * Checks whether a union member is the `undefined` or `null` type keyword.
 *
 * @param member - union member to test
 *
 * @returns whether member is a nullish keyword type
 *
 * @example
 * ```ts
 * isNullishMember(member); // true for the `undefined` in `string | undefined`
 * ```
 */
function isNullishMember(member: ESTree.TSType,): boolean {
  return NULLISH_KEYWORD_TYPES.has(member.type,);
}

/**
 * Bans union types containing `null` or `undefined` (`T | undefined`,
 * `undefined | T`, `T | null`, `null | T`, or either nullish keyword anywhere
 * in a union).
 *
 * `tsconfig` sets `exactOptionalPropertyTypes: true`. Widening a slot to
 * `T | undefined` skirts that setting instead of fixing the real problem: it
 * lets `undefined` flow into a typed position the optional-property machinery
 * was meant to keep absent. Pivoting that same slot to `T | null` is not a fix;
 * it is the identical nullish escape with a different keyword. Both `null` and
 * `undefined` union members are banned. The proper fixes:
 *
 * - Optional property or field: write `foo?: T`, never `foo?: T | undefined`
 *   and never `foo: T | undefined`. Under `exactOptionalPropertyTypes`, `?:`
 *   already means "absent or `T`"; the `| undefined` adds nothing and reopens
 *   the hole the setting closes.
 * - Value that may be missing at runtime: guard with `if` so the nullish value
 *   never flows into the typed slot, or carry a genuine sentinel value. A
 *   genuine sentinel is a unique `Symbol` (or a non-nullish domain value);
 *   `null` and `undefined` can never be sentinels, because they are the very
 *   values this rule rejects.
 *
 * `void` (`TSVoidKeyword`) is out of scope; only the `undefined`
 * (`TSUndefinedKeyword`) and `null` (`TSNullKeyword`) keyword members trigger
 * the rule. A standalone `type X = undefined` or `type X = null` is not a union
 * and is not flagged.
 *
 * Genuine external-boundary cases (a parameter or return mirroring a
 * third-party API type that is itself `T | undefined` or `T | null`) remain
 * handleable with a tightly scoped
 * `oxlint-disable-next-line no-restricted-syntax/no-nullish-union` carrying a
 * justification.
 *
 * @example
 * ```ts
 * // Bad
 * let x: number | undefined;
 * let y: number | null;
 * type Opt = { foo?: string | undefined; };
 * function find(): string | null {}
 * function take(x: number | undefined): void {}
 * const p: Promise<number | null> = load();
 *
 * // Good
 * type Opt = { foo?: string; };
 * const value = lookup(key);
 * if (value === undefined) {
 *   return;
 * }
 * // value is now `T`, never `T | undefined`
 *
 * // Good; genuine Symbol sentinel instead of the union
 * const NOT_FOUND = Symbol('not-found');
 * type Result = string | typeof NOT_FOUND;
 * ```
 */
export const noNullishUnion: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow union types containing `null` or `undefined` (`T | null`, `T | undefined`). exactOptionalPropertyTypes is on; use `foo?: T`, an if-guard, or a genuine `Symbol` sentinel (never null/undefined) instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Union types containing `null` or `undefined` are banned (exactOptionalPropertyTypes is on; widening to `T | null` or `T | undefined` skirts it, and pivoting `undefined` to `null` is the same nullish escape). For an optional property use `foo?: T` (not `foo?: T | undefined` and not `foo: T | undefined`). For a value that may be missing at runtime, guard with `if` so the nullish value never flows into the typed slot, or use a genuine sentinel. A genuine sentinel is a unique `Symbol` (or a non-nullish domain value); `null` and `undefined` can never be sentinels, because they are the very values this rule rejects. `void` is out of scope.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      TSUnionType(node: ESTree.TSUnionType,): void {
        if (node.types
          .some(isNullishMember,)) {
          context.report({
            node,
            messageId: 'forbidden',
          },);
        }
      },
    };
  },
};
