# @monochromatic-dev/config-oxlint-no-restricted-syntax

Ready to publish.

Oxlint JS plugin implementing `no-restricted-syntax` rules
that oxlint does not support natively.

Oxlint lacks ESLint's `no-restricted-syntax` rule because it requires
a full AST selector engine.
This plugin provides individual rules for each banned syntax pattern instead.

## Rules

- **no-arrow-function**: bans arrow functions in favor of named function declarations/expressions
- **no-enum**: bans `enum` declarations in favor of union types with `as const`
- **no-for-in**: bans `for...in` loops in favor of `Object.entries`/`Object.keys`/`Object.values`
- **no-function-root-let**: bans `let` at function-body root unless the helper-shape exception applies
- **no-hasownproperty**: bans `.hasOwnProperty()` in favor of `Object.hasOwn()`
- **no-module-root-let**: bans module-root `let` in favor of containers or memoization helpers
- **no-promise-catch**: bans `.catch()` chaining in favor of `try`/`catch` with `async`/`await`
- **no-promise-finally**: bans `.finally()` chaining in favor of `using`/`await using`
- **no-regex**: requires regex usage to be justified through a scoped `oxlint-disable` comment
- **no-regexp-exec**: bans `RegExp.prototype.exec()` in favor of `str.match()`/`str.matchAll()`
- **no-rest-params**: bans rest parameters (`...args`) in favor of explicit array parameters
- **no-switch**: bans `switch` statements in favor of if/else chains or `Record` lookups
- **no-trim-left-right**: bans `.trimLeft()`/`.trimRight()` in favor of `.trimStart()`/`.trimEnd()`
- **no-try-finally**: bans `try...finally` blocks in favor of `using`/`await using`
- **no-nullish-union**: bans union types containing `null` or `undefined` (`T | null`, `T | undefined`); use `?:`, an if-guard, or a genuine `Symbol` sentinel
- **no-optional-escape**: bans every other statically-detectable type-level fake-optional encoding (`| void`, `| never`, `| unknown`/`| any`, falsy literal members, `| {}`, empty/optional/rest-only tuples, `Partial<T>`, `Record<K, never>`, added-optionality mapped types)
- **no-variable-function-expression**: bans `const x = function() {}`, use a function declaration instead
- **require-destructured-params**: function declarations with 2+ params must use a single destructured object
- **require-queryselector-generic**: requires explicit generic typing for querySelector-style calls

`no-regex` is enabled by the shared `@monochromatic-dev/config-oxlint` package.
Necessary regex sites must use scoped disable justifications.

## no-nullish-union

`tsconfig` sets `exactOptionalPropertyTypes: true`.
Widening a type to `T | undefined` skirts that setting instead of fixing the underlying problem;
it lets `undefined` flow into a typed position the optional-property machinery was meant to keep absent.
Pivoting the same slot to `T | null` is not a fix; it is the identical nullish escape with a different keyword.
The rule flags any `TSUnionType` with a `TSUndefinedKeyword` or `TSNullKeyword` member: `T | undefined`, `undefined | T`, `T | null`, `null | T`, and either nullish keyword anywhere in a union, including nested forms such as `Promise<T | null>` and `Array<T | undefined>`.

`void` (`TSVoidKeyword`) is out of scope;
only the `undefined` (`TSUndefinedKeyword`) and `null` (`TSNullKeyword`) keywords trigger the rule.
`TSNullKeyword` is the `null` type keyword, distinct from the `null` literal node `TSNullLiteral`.
A standalone `type X = undefined` or `type X = null` is not a union and is not flagged.

Proper fixes:

- Optional property or field: write `foo?: T`, never `foo?: T | undefined` and never `foo: T | undefined`. Under `exactOptionalPropertyTypes`, `?:` already means "absent or `T`"; the `| undefined` adds nothing and reopens the hole the setting closes.
- Value that may be missing at runtime: guard with `if` so the nullish value never flows into the typed slot, or carry a genuine sentinel value. A genuine sentinel is a unique `Symbol` (or a non-nullish domain value); `null` and `undefined` can never be sentinels, because they are the very values this rule rejects.

```typescript
// Bad
let cached: Provider | undefined;
let head: Node | null;
type Options = { existing?: ExistingNode | undefined; };
function find(): string | null {}

// Good
type Options = { existing?: ExistingNode; };

const value = lookup(key,);
if (value === undefined)
  return;
// value is now `T`, never `T | undefined`

// Good; genuine Symbol sentinel instead of the union
const NOT_FOUND = Symbol('not-found',);
type Result = string | typeof NOT_FOUND;
```

Genuine external-boundary cases (a parameter mirroring a third-party API type that is itself `T | undefined` or `T | null`) stay handleable with a tightly scoped `oxlint-disable-next-line no-restricted-syntax/no-nullish-union` carrying a justification.

## no-optional-escape

`exactOptionalPropertyTypes: true` keeps `undefined` out of typed slots.
Agents repeatedly invent new type-level encodings to dodge it: once `| undefined` and `| null` were banned, the next dodge was `| void`, then tuple-as-Maybe, then literal sentinels, then `Partial<T>`.
This rule enumerates and bans the whole statically-detectable space in one pass.
`| undefined` and `| null` stay with `no-nullish-union`; everything else lives here.

The fixes are the same four: `foo?: T` for an optional property; an `if`-guard so the value is always present where typed; throw via `nonNullishOrThrow` (`@monochromatic-dev/module-or-throw`); or a real sentinel (a unique `Symbol`, or a distinct non-empty domain value).
A genuine external-boundary mirror uses a scoped `oxlint-disable-next-line no-restricted-syntax/no-optional-escape` with a justification.

### Banned (each its own diagnostic)

Union members:

- `T | void`: `void` is assignable from `undefined`, so it widens the slot.
- `T | never`: collapses to `T`; a hand-written `| never` is a stubbed-out absence branch.
- `T | unknown` and `T | any`: collapse to the wide type, accepting everything including nullish.
- `T | {}`: an empty object type widens to any non-nullish value.
- Falsy literal members: the empty string `""`, an empty template literal type, zero `0`, a negative number such as `-1`, and `false`. Flagged only when the union also has a non-literal member, so a finite literal domain like `0 | 1 | 2` is left alone.

Tuples:

- Empty tuple `[]`.
- Optional element `[T?]`.
- Optional named member `[foo?: T]`.
- Rest-only tuple `[...T[]]` (functionally `T[]` dressed as 0-or-many).

Type references and mapped types:

- `Partial<T>` (makes every property optional).
- `Record<K, never>` and `Pick<T, never>` (produce an empty object).
- A mapped type that adds optionality, `{ [K in keyof T]?: ... }` (a hand-rolled `Partial`).

### Allowed (not flagged)

- A bare `(): void` return; only `void` inside a union is banned.
- `T | null` and `T | undefined`, owned by `no-nullish-union`.
- A fixed non-empty tuple `[number, string]`, and a leading-element variadic tuple `[T, ...U[]]` (one-or-more).
- A real `Symbol` sentinel via `typeof MY_SYMBOL`.
- A non-empty literal member (`T | 42`, `T | "pending"`) and pure literal domains (`0 | 1 | 2`, `"a" | "b"`).
- A real `Record<K, V>` or `Pick<T, K>`, and the `Required` mapped form `{ [K in keyof T]-?: ... }`.

### Statically undetectable (review-only blind spots)

A pattern is undetectable when the type annotation itself is honest and carries no syntactic marker of absence; there is nothing for an AST rule to see.

- A field typed `string` but defaulted to `""` at runtime: the type is `string`, an honest annotation.
- A `T[]` whose emptiness encodes absence: the type is `T[]`, honest.
- `0` or `-1` used as absent on a plain `number`: the type is `number`, honest. (Contrast `T | 0`, which is a literal-type union and is banned.)
- `T | typeof CONST` where `CONST` resolves to a falsy literal: the `typeof` node is identical whether `CONST` is a real `Symbol` or an empty string (verified by AST probe), so distinguishing it needs binding resolution. Reliable only for a same-file literal-initialized `const`; cross-file or imported `CONST` needs the type-checker the JS plugin lacks. Not implemented.
- `Omit<T, keyof T>` (equals `{}`): detectable in principle but needs a structural match between the `keyof T` argument and `T`; fragile, not implemented.
- `class Sentinel {}` plus `T | typeof Sentinel`: same blind spot as `typeof CONST`, and a class instance type is itself a distinct non-empty value, so it is an allowed sentinel anyway.
- `0n` (bigint zero) as a union literal: deliberately skipped; rare, and bigint literals add magic-literal friction for little gain.
- `NaN` as a union member is not expressible (`NaN` is a value, not a type), so there is nothing to detect.

## Ban-disable rules

The plugin also includes `no-disable-*` rules that block broad or stale disable comments.
Use a tightly-scoped `oxlint-disable-next-line` with a justification when a rule cannot be satisfied structurally.

## Usage

```typescript
// oxlint.config.ts
import { defineConfig, } from 'oxlint';
export default defineConfig({
  jsPlugins: ['@monochromatic-dev/config-oxlint-no-restricted-syntax',],
},);
```
