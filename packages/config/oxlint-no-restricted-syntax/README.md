# @monochromatic-dev/config-oxlint-no-restricted-syntax

Ready to publish.

Oxlint JS plugin implementing `no-restricted-syntax` rules
that oxlint does not support natively.

Oxlint lacks ESLint's `no-restricted-syntax` rule because it requires
a full AST selector engine.
This plugin provides individual rules for each banned syntax pattern instead.

## Rules

- **no-arrow-function** -- bans arrow functions in favor of named function declarations/expressions
- **no-enum** -- bans `enum` declarations in favor of union types with `as const`
- **no-for-in** -- bans `for...in` loops in favor of `Object.entries`/`Object.keys`/`Object.values`
- **no-function-root-let** -- bans `let` at function-body root unless the helper-shape exception applies
- **no-hasownproperty** -- bans `.hasOwnProperty()` in favor of `Object.hasOwn()`
- **no-module-root-let** -- bans module-root `let` in favor of containers or memoization helpers
- **no-promise-catch** -- bans `.catch()` chaining in favor of `try`/`catch` with `async`/`await`
- **no-promise-finally** -- bans `.finally()` chaining in favor of `using`/`await using`
- **no-regexp-exec** -- bans `RegExp.prototype.exec()` in favor of `str.match()`/`str.matchAll()`
- **no-rest-params** -- bans rest parameters (`...args`) in favor of explicit array parameters
- **no-switch** -- bans `switch` statements in favor of if/else chains or `Record` lookups
- **no-trim-left-right** -- bans `.trimLeft()`/`.trimRight()` in favor of `.trimStart()`/`.trimEnd()`
- **no-try-finally** -- bans `try...finally` blocks in favor of `using`/`await using`
- **no-variable-function-expression** -- bans `const x = function() {}`, use a function declaration instead
- **require-destructured-params** -- function declarations with 2+ params must use a single destructured object
- **require-queryselector-generic** -- requires explicit generic typing for querySelector-style calls

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
