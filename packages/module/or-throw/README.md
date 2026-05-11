# module-or-throw

Runtime assertions that pass the value through or throw.

Each helper narrows the static type when the runtime check passes,
and throws an `Error` describing the offending value when the check fails.
Use these wherever the non-null assertion operator (`!`) would otherwise be reached for:
the runtime check turns a silent type lie into a loud, debuggable failure.

## Helpers

### Boolean shape

| Function            | Throws when                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| `nonNullishOrThrow` | value is `null` or `undefined`                                                  |
| `truthyOrThrow`     | value is falsy (`false`, `0`, `0n`, `''`, `null`, `undefined`, or `NaN`)        |
| `falsyOrThrow`      | value is truthy                                                                 |

### Container size

| Function          | Throws when                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `emptyOrThrow`    | value lacks a recognized size shape, or has nonzero size                          |
| `nonemptyOrThrow` | value lacks a recognized size shape, or has zero size                             |

Recognized size shapes: strings, arrays, `Set`, `Map`, plain objects.
`WeakSet` and `WeakMap` are intentionally rejected (no enumerable size).
Bare iterables and async iterables are rejected (sizing requires consumption).

### Iterable protocols

| Function                    | Throws when                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `iterableOrThrow`           | value does not implement the sync-iterable protocol          |
| `asyncIterableOrThrow`      | value does not implement the async-iterable protocol         |
| `maybeAsyncIterableOrThrow` | value implements neither protocol                            |

Strings count as sync-iterable.
Objects must have `Symbol.iterator` or `Symbol.asyncIterator` to pass.

### Container instances

| Function            | Throws when                                  |
| ------------------- | -------------------------------------------- |
| `arrayOrThrow`      | `Array.isArray(value)` is `false`            |
| `setOrThrow`        | value is not `instanceof Set`                |
| `mapOrThrow`        | value is not `instanceof Map`                |
| `weakSetOrThrow`    | value is not `instanceof WeakSet`            |
| `weakMapOrThrow`    | value is not `instanceof WeakMap`            |

### Standard built-ins

| Function          | Throws when                                  |
| ----------------- | -------------------------------------------- |
| `promiseOrThrow`  | value is not `instanceof Promise`            |
| `dateOrThrow`     | value is not `instanceof Date`               |
| `regExpOrThrow`   | value is not `instanceof RegExp`             |
| `errorOrThrow`    | value is not `instanceof Error`              |

`dateOrThrow` does not check date validity (invalid dates still pass).
`promiseOrThrow` rejects thenables.
`errorOrThrow` rejects error-shaped plain objects.

### typeof primitives

| Function           | Throws when                                                |
| ------------------ | ---------------------------------------------------------- |
| `stringOrThrow`    | `typeof value !== 'string'`                                |
| `numberOrThrow`    | `typeof value !== 'number'` (accepts `NaN` and `Infinity`) |
| `bigintOrThrow`    | `typeof value !== 'bigint'`                                |
| `booleanOrThrow`   | `typeof value !== 'boolean'`                               |
| `symbolOrThrow`    | `typeof value !== 'symbol'`                                |
| `functionOrThrow`  | `typeof value !== 'function'`                              |
| `objectOrThrow`    | `typeof value !== 'object'` or `value === null`            |

Boxed-primitive wrappers (`new String(...)`, `new Number(...)`, etc.) are intentionally rejected.

### Numeric union

| Function          | Throws when                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `numericOrThrow`  | value is neither `number` nor `bigint`                            |

`numericOrThrow` corresponds to the `t numeric/` category in `module-es`.

## Usage

```ts
import {
  arrayOrThrow,
  nonNullishOrThrow,
  stringOrThrow,
} from '@monochromatic-dev/module-or-throw';

const el = nonNullishOrThrow(document.querySelector('.target',),);
// el is Element (was Element | null)

const text = stringOrThrow(el.textContent,);
// text is string (was string | null)

const tokens = arrayOrThrow(text.match(/\w+/g,),);
// tokens is readonly unknown[] (was RegExpMatchArray | null)
```

## Types

```ts
import type { ExtractOrUnknown, Falsy, } from '@monochromatic-dev/module-or-throw';
```

- `Falsy`: union of `false | 0 | 0n | '' | null | undefined`.
  `NaN` is falsy at runtime but cannot be represented as a literal type.
- `ExtractOrUnknown<T, U>`: variant of `Extract<T, U>` that returns `U` when `T` is `unknown`,
  instead of collapsing to `never`.
  Used internally by every `Extract`-based narrowing helper so `unknown` inputs
  (e.g. parsed JSON) narrow correctly.

## NaN caveat

`NaN` is falsy at runtime but cannot be represented as a TypeScript literal type.
`truthyOrThrow(NaN,)` throws at runtime,
but TypeScript cannot statically exclude `NaN` from a `number` parameter,
so the returned type is the same `number`.
`numberOrThrow` accepts `NaN`: it is a number-typed value.
Callers that need a NaN-narrowed type must use `Number.isNaN` separately.

## Design decisions

- **Source-only.** The package has no build step; consumers import directly from `src/index.ts`.
- **Direct named exports.** No `$` aliasing. Consumers write `import { nonNullishOrThrow }` and call the function by its real name.
- **One file per helper.** Each helper owns a sibling file; `index.ts` is a pure re-export barrel.
- **Family convention.** Every helper in this package uses the `<predicate>OrThrow` suffix
  so the throw semantics are explicit at every call site,
  even when the import line is folded or out of view.
- **`ExtractOrUnknown` over `Extract`.** Plain `Extract<unknown, X>` evaluates to `never`,
  silently breaking the most common call shape (a value typed `unknown` from parsed JSON or
  a fetched payload). Every narrowing helper uses `ExtractOrUnknown` instead.
- **Skipped categories.** Value-range refinements (`positiveOrThrow`, `finiteOrThrow`,
  `integerOrThrow`) and parameterized helpers (`instanceOfOrThrow(value, ctor)`) are
  intentionally out of scope; add them when a call site needs them.
