# @monochromatic-dev/config-oxlint-no-restricted-syntax

Oxlint JS plugin implementing `no-restricted-syntax` rules
that oxlint does not support natively.

Oxlint lacks ESLint's `no-restricted-syntax` rule because it requires
a full AST selector engine.
This plugin provides individual rules for each banned syntax pattern instead.

## Rules

- **no-arrow-function** -- bans arrow functions in favor of named function declarations/expressions
- **no-enum** -- bans `enum` declarations in favor of union types with `as const`
- **no-for-in** -- bans `for...in` loops in favor of `Object.entries`/`Object.keys`/`Object.values`
- **no-hasownproperty** -- bans `.hasOwnProperty()` in favor of `Object.hasOwn()`
- **no-promise-catch** -- bans `.catch()` chaining in favor of `try`/`catch` with `async`/`await`
- **no-promise-finally** -- bans `.finally()` chaining in favor of `using`/`await using`
- **no-regexp-exec** -- bans `RegExp.prototype.exec()` in favor of `str.match()`/`str.matchAll()`
- **no-rest-params** -- bans rest parameters (`...args`) in favor of explicit array parameters
- **no-switch** -- bans `switch` statements in favor of if/else chains or `Record` lookups
- **no-trim-left-right** -- bans `.trimLeft()`/`.trimRight()` in favor of `.trimStart()`/`.trimEnd()`
- **no-try-finally** -- bans `try...finally` blocks in favor of `using`/`await using`
- **no-variable-function-expression** -- bans `const x = function() {}`, use a function declaration instead
- **require-destructured-params** -- function declarations with 2+ params must use a single destructured object

## Usage

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["@monochromatic-dev/config-oxlint-no-restricted-syntax"],
  "rules": {
    "no-restricted-syntax/no-arrow-function": "error",
    "no-restricted-syntax/no-enum": "error",
    "no-restricted-syntax/no-for-in": "error",
    "no-restricted-syntax/no-hasownproperty": "error",
    "no-restricted-syntax/no-promise-catch": "error",
    "no-restricted-syntax/no-promise-finally": "error",
    "no-restricted-syntax/no-regexp-exec": "error",
    "no-restricted-syntax/no-rest-params": "error",
    "no-restricted-syntax/no-switch": "error",
    "no-restricted-syntax/no-trim-left-right": "error",
    "no-restricted-syntax/no-try-finally": "error",
    "no-restricted-syntax/no-variable-function-expression": "error",
    "no-restricted-syntax/require-destructured-params": "error"
  }
}
```
