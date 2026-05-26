# Planning: invocation-depth-per-line stylistic rule

Status: ready to implement.

## Goal

Add a separate Oxlint stylistic rule named `stylistic/invocation-depth-per-line`.
The rule limits nested invocation density on a single source line.

The rule fills the one-operand gap left by existing layout rules:

- `packages/config/oxlint-stylistic/src/rules/argument-per-line.ts` owns calls
  with two or more arguments.
- `packages/config/oxlint-stylistic/src/rules/param-per-line.ts` owns function-like
  declarations with two or more parameters.
- `packages/config/oxlint-stylistic/src/rules/chain-per-line.ts` owns receiver,
  member, call-result, binary, and logical chains.

This new rule owns single-operand invocation spines such as `a(b(c()))`.

## Rule identity

- Package: `packages/config/oxlint-stylistic`.
- Rule name: `invocation-depth-per-line`.
- Config key: `stylistic/invocation-depth-per-line`.
- Default severity: `warn`, matching other stylistic rules in
  `packages/config/oxlint/src/rules/style.ts`.
- Threshold: hardcode a maximum of two counted invocations per source line.

## Core invariant

`a(b())` passes because the line contains two counted invocations.

```ts
// PASS
const value = a(b());
```

`a(b(c()))` fails because the line contains three counted invocations.

```ts
// FAIL
const value = a(b(c()));

// PASS
const value = a(
  b(c()),
);
```

The rule is line-sensitive and threshold-only.
It does not require one canonical layout when a noncanonical layout already keeps each line at depth two or less.

```ts
// PASS: no line has more than two counted invocations.
const value = a(b(
  c(),
));

// PASS: autofix may prefer this shape, but lint does not require it.
const value = a(
  b(c()),
);
```

## Counted invocation forms

Count these as invocations:

- `CallExpression`, including optional calls such as `fn?.()`.
- `NewExpression`.
- `ImportExpression` for dynamic `import()`.

Do not count `TaggedTemplateExpression` itself.
A tagged-template wrapper breaks the parent operand spine.
Calls inside template interpolations still get checked as independent descendant spines.

```ts
// PASS: tag wrapper breaks the outer spine, and b(c()) is only depth two.
const value = a(tag`${b(c())}`);

// FAIL: descendant interpolation spine b(c(d())) has three calls on one line.
const value = a(tag`${b(c(d()))}`);

// PASS
const value = a(tag`${b(
  c(d()),
)}`);
```

## Operand-spine scope

Only operand nesting counts.
Callee chains such as `factory()()()` stay out of scope for this rule.
`chain-per-line` remains responsible for call-result and member chains.

```ts
// FAIL: nested through single operands.
const value = a(b(c()));

// PASS for this rule: nested through callee position.
const value = factory()()();
```

Containers break the parent spine, but descendants inside containers remain checkable.
Existing container layout rules continue to own container formatting.

```ts
// PASS: object literal breaks a -> b, and b(c()) is only depth two.
const value = a({ value: b(c()) });

// FAIL: inner b(c(d())) is checked independently.
const value = a({ value: b(c(d())) });

// PASS
const value = a({ value: b(
  c(d()),
) });
```

## Single-operand gate

The rule traverses through a counted invocation only when that invocation has exactly one operand.
This avoids taking ownership away from `argument-per-line` for multi-argument calls.

Child single-operand spines inside multi-argument parents still get checked.
Both rules may report the same original expression, and repeated `oxlint --fix` passes may be needed.
That matches the existing multi-fix convergence behavior documented in
`docs/troubleshooting/oxlint-multi-fix-convergence.md`.

```ts
// FAIL: argument-per-line owns a(...), invocation-depth-per-line owns b(...).
const value = a(b(c(d())), other);

// PASS after converged fixes.
const value = a(
  b(
    c(d()),
  ),
  other,
);

// PASS for invocation-depth-per-line: child spine depth is only two.
const value = a(b(c()), other);
```

For dynamic import, the source is the single operand only when `options` is absent.

```ts
// FAIL: import has one operand, source.
const value = a(import(b(c())));

// PASS
const value = a(
  import(b(c())),
);

// PASS for this rule: import has source plus options.
const value = a(import(b(c()), opts));
```

## Transparent wrappers

These wrappers do not break the operand spine:

- Parenthesized expressions.
- `ChainExpression` wrappers from optional chaining.
- `AwaitExpression`.
- `UnaryExpression`, including semantic unary operators such as `void`, `!`, `typeof`, `+`, and `-`.
- `YieldExpression`, including `yield*`.
- `SpreadElement` when it is the single call or constructor argument.
- TypeScript wrappers: `TSAsExpression`, `TSSatisfiesExpression`, `TSTypeAssertion`,
  `TSNonNullExpression`, and `TSInstantiationExpression`.

```ts
// FAIL
const value = a(await b(c()));

// PASS
const value = a(
  await b(c()),
);

// FAIL
const value = a(void b(c()));

// PASS
const value = a(
  void b(c()),
);

// FAIL
const value = a(...b(c()));

// PASS
const value = a(
  ...b(c()),
);
```

## Line attribution

Count each invocation on its invocation-head line, not on the start line of wrappers
and not on every line of the invocation span.

```ts
// FAIL: a, b, and c heads start on the same line.
const value = a(await b(c()));

// PASS: c starts on its own line.
const value = a(await b(
  c(),
));

// FAIL: a, new B, and c heads start on the same line.
const value = a(new B(c()));

// PASS: c starts on its own line.
const value = a(new B(
  c(),
));
```

## Diagnostic ownership

Report the highest invocation on the offending line.
If an outer invocation is already split and only a child line exceeds the threshold,
report the child invocation.

```ts
// FAIL: diagnostic on a(...), because line 1 contains a + b + c.
const value = a(b(c()));

// PASS
const value = a(
  b(c()),
);

// FAIL: diagnostic on b(...), because line 2 contains b + c + d.
const value = a(
  b(c(d())),
);

// PASS
const value = a(
  b(
    c(d()),
  ),
);
```

When multiple independent child spines sit inside a container, let existing container rules own the container layout.
`invocation-depth-per-line` may still report each independently fixable invocation spine.

```ts
// FAIL: object-property-per-line owns the object, invocation-depth-per-line owns child spines.
const value = { x: b(c(d())), y: e(f(g())) };

// PASS after converged fixes.
const value = {
  x: b(
    c(d()),
  ),
  y: e(
    f(g()),
  ),
};
```

## Autofix behavior

The fixer splits the offending invocation's single operand onto its own line.
It uses the base indentation of the invocation's source line plus two spaces for the operand line.
The closing delimiter returns to the base indentation of that source line.

```ts
// FAIL
const value = a(b(c()));

// PASS after fix
const value = a(
  b(c()),
);

// FAIL
  const value = a({ value: b(c(d())) });

// PASS after fix
  const value = a({ value: b(
    c(d()),
  ) });
```

The fixer always adds a trailing comma when it splits the operand.

```ts
// FAIL
const value = a(await b(c()));

// PASS after fix
const value = a(
  await b(c()),
);
```

For trailing comments, the comma goes before the trailing comment.

```ts
// FAIL
const value = a(b(c()) // keep
);

// PASS after fix
const value = a(
  b(c()), // keep
);

// FAIL
const value = a(b(c()) /* keep */);

// PASS after fix
const value = a(
  b(c()), /* keep */
);
```

## Implementation notes

Use an iterative traversal for operand spines.
Invocation nesting can be as deep as source length, so recursive traversal over the spine risks stack overflow.

The rule needs source-line utilities for invocation heads, not whole-span overlap checks.
Whole-span overlap would make already-compliant multiline code fail because outer invocations span child lines.

The visitor should include `CallExpression`, `NewExpression`, and `ImportExpression`.
Do not visit `TaggedTemplateExpression` as a counted invocation owner.
Descendant calls inside template interpolations can be handled by ordinary call visitors.

## Test coverage

Add invalid fixtures for:

- Plain calls: `a(b(c()))`.
- Constructors: `new A(b(c()))` and `a(new B(c()))`.
- Optional calls: `a(b?.(c()))`.
- Dynamic import with one operand: `a(import(b(c())))`.
- Transparent wrappers: `await`, unary, `yield`, spread, parentheses, and TypeScript wrappers.
- Already-split child-line violation: `a(\n  b(c(d())),\n)`.
- Descendant spines inside containers and tagged-template interpolations.
- Comment-aware autofix for trailing line and block comments.
- Overlap convergence with `argument-per-line` on `a(b(c(d())), other)`.

Add valid fixtures for:

- Depth two: `a(b())`.
- Threshold-only noncanonical split: `a(b(\n  c(),\n))`.
- Callee chains: `factory()()()`.
- Multi-argument parent with depth-two child: `a(b(c()), other)`.
- Dynamic import with options: `a(import(b(c()), opts))`.
- Tagged-template wrapper with depth-two interpolation: `` a(tag`${b(c())}`) ``.
