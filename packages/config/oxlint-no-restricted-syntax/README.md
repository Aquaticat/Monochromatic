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
- **no-undefined-union**: bans union types containing `undefined` (`T | undefined`); use `?:`, an if-guard, or a named sentinel
- **no-variable-function-expression**: bans `const x = function() {}`, use a function declaration instead
- **require-destructured-params**: function declarations with 2+ params must use a single destructured object
- **require-queryselector-generic**: requires explicit generic typing for querySelector-style calls

`no-regex` is enabled by the shared `@monochromatic-dev/config-oxlint` package.
Necessary regex sites must use scoped disable justifications.

## no-undefined-union

`tsconfig` sets `exactOptionalPropertyTypes: true`.
Widening a type to `T | undefined` skirts that setting instead of fixing the underlying problem;
it lets `undefined` flow into a typed position the optional-property machinery was meant to keep absent.
The rule flags any `TSUnionType` with a `TSUndefinedKeyword` member: `T | undefined`, `undefined | T`, and `undefined` anywhere in a union, including nested forms such as `Promise<T | undefined>` and `Array<T | undefined>`.

`void` (`TSVoidKeyword`) and `null` (`TSNullKeyword`) are out of scope;
only the `undefined` keyword triggers the rule.
A standalone `type X = undefined` is not a union and is not flagged.

Proper fixes:

- Optional property or field: write `foo?: T`, never `foo?: T | undefined` and never `foo: T | undefined`. Under `exactOptionalPropertyTypes`, `?:` already means "absent or `T`"; the `| undefined` adds nothing and reopens the hole the setting closes.
- Value that may be missing at runtime: guard with `if` so `undefined` never flows into the typed slot, or carry an explicit named sentinel value, never the `| undefined` union.

```typescript
// Bad
let cached: Provider | undefined;
type Options = { existing?: ExistingNode | undefined; };
function find(): string | undefined {}

// Good
type Options = { existing?: ExistingNode; };

const value = lookup(key,);
if (value === undefined)
  return;
// value is now `T`, never `T | undefined`

// Good; named sentinel instead of the union
const NOT_FOUND = Symbol('not-found',);
type Result = string | typeof NOT_FOUND;
```

Genuine external-boundary cases (a parameter mirroring a third-party API type that is itself `T | undefined`) stay handleable with a tightly scoped `oxlint-disable-next-line no-restricted-syntax/no-undefined-union` carrying a justification.

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
