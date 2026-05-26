# @monochromatic-dev/config-oxlint-stylistic

Oxlint JS plugin for TypeScript stylistic rules:
one-item-per-line formatting across multi-element constructs,
statement-boundary semicolon enforcement,
and explicit operator structure in nested expressions.

The per-line rules fire when 2 or more items share a source line
and auto-fix by placing every item on its own line with consistent indentation.
dprint's TypeScript formatter is disabled in this repository (replaced by this plugin),
so this plugin is the active layout authority for TypeScript expressions;
dprint still formats the other languages.

The expression-structure rules surface ambiguous operator precedence
by requiring explicit parentheses at operator boundaries.

## Rules

### Per-line rules

All per-line rules are auto-fixable via `oxlint --fix`.

- **param-per-line**: each function parameter on its own line.
  Covers `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`
  and the full TypeScript function-like set:
  `TSFunctionType`, `TSDeclareFunction`, `TSMethodSignature`,
  `TSCallSignatureDeclaration`, `TSConstructSignatureDeclaration`,
  `TSConstructorType`, `TSEmptyBodyFunctionExpression`.
- **argument-per-line**: each function call argument on its own line (`CallExpression`, `NewExpression`)
- **array-element-per-line**: each array literal element on its own line
- **object-property-per-line**: each object literal property on its own line
- **import-per-line**: each named import specifier on its own line
- **export-per-line**: each named export specifier on its own line
- **type-property-per-line**: each type literal or interface member on its own line
- **tuple-per-line**: each tuple type element on its own line
- **destructure-per-line**: each destructured property on its own line

### Statement boundaries

- **one-var-declaration-per-line**: each declarator in a `var`/`let`/`const`/`using` declaration on its own line.
  Operates in `'always'` mode: every multi-declarator declaration is flagged
  regardless of whether declarators have initializers.
  Auto-fixable; fix is suppressed if a comment lives between declarators (preserves the comment).
- **max-statements-per-line**: at most one statement per source line.
  Single-child container parents (`if`/`while`/`for`/`labeled`/`export-default`/`export-named`)
  exempt their inner statement, so `if (a) foo();` is allowed; the alternate branch of `if`/`else`
  is not exempt, so `if (a) foo(); else bar();` flags `bar()`.
  Auto-fixable; fix is suppressed if a comment lives between statements (preserves the comment).
- **semi**: require semicolons at the end of statement-like declarations and expressions.
  Mirrors `@stylistic/semi` in its default `"always"` mode only.
  The rule has no options: configure it as `"stylistic/semi": "error"`, not as
  `["error", "always"]`.
  Auto-fixable; the fixer inserts `;` after the node's last syntax token.

### Expression structure

- **no-mixed-operators**: require parentheses around nested binary or logical expressions
  whose operator differs from the parent.
  Same-operator chains (`a + b + c`, `x && y && z`) are permitted because they are unambiguous under associativity.
  Mixed operators (`a + b * c`, `x || y && z`) must be disambiguated with explicit parens.
  Not auto-fixable.
- **chain-per-line**: require one chain segment per source line for binary, logical,
  member, and call chains, laying out the operator and member axes independently.
  The message is `Put each operator, member, or method step in this chain on its own line.`
  Firing once on the outermost chain root, the rule computes break offsets on decoupled
  axes: a member or call chain breaks on its own member-step count, and an operator chain
  breaks on its own operator count, so neither axis inflates the other.
  A break point is a member-name step (`.name`, `?.name`) or a binary or logical
  operator's right operand (the operator renders leading, for example `+ c`);
  call steps (`(args)`) and computed steps (`[expr]`, `?.[expr]`) are attached and ride on
  the line before them.
  A member or call chain keeps the leaf and the first member step on the head line and
  breaks every later step.
  An operator chain keeps the source-first operator on the head line and breaks the rest;
  but when any operand's own member chain breaks, every operator also moves to its own
  line.
  The two axes do not interact, so a single operator whose operand is a one-step member
  access stays on one line: `a.b === c` and `task.dueDate ?? '?'` do not break.
  A multi-step member operand does break, carrying its operator onto a line of its own:
  `a.b.c > 0` becomes `a.b` then `.c` then `> 0`.
  Short chains stay on one line: `obj.method()`, `arr[0][1]`, `a + b`, `a.b === c`.
  Multi-step chains break: `obj.foo.bar` becomes `obj.foo` then `.bar`;
  `a + b + c + d` keeps `a + b` on the head line then `+ c` then `+ d`;
  `arr.map(f).filter(g)`, `obj.a.b.c`, and `foo().bar()` all split.
  Covers `BinaryExpression`, `LogicalExpression`, `MemberExpression`, `CallExpression`,
  including optional chaining (`?.`), computed access (`a[b]`), call chains (`f().g()`),
  TypeScript type arguments (`a.b<T>().c`), right-associative `**`, and chains threaded
  through `!`, `as`, and `satisfies` (`a.b!.c.d` splits).
  Grouping parentheses isolate inner chains (`(a + b) + c` keeps `(a + b)` opaque);
  the rule trusts `no-mixed-operators` to have parenthesized mixed precedence, so it
  flattens an unparenthesized operator run as one chain regardless of operator text.
  The autofix inserts newlines only at break offsets and slices everything else verbatim,
  so operand text survives, it leaves no trailing whitespace, and it converges to a fixed
  point.
  It never collapses whitespace at non-break points: a legacy split that the decoupled
  rule no longer breaks (no break offsets) is left verbatim and goes unreported rather
  than being rejoined onto one line.
  The fix is suppressed (the rule reports without a fix) only when a comment sits in the
  collapsible head, before the first break offset;
  a comment at or after the first break rides verbatim on its continuation slice, so the
  fix still applies (for example a comment buried in a trailing call's arguments).
  Tagged templates (`` tag`x` ``) and `new` expressions are opaque leaves, not chain
  participants.
  When `no-mixed-operators` and `chain-per-line` both apply to one region, several
  `oxlint --fix` passes are needed (an upstream single-pass limitation): the chain
  breaks, the wrap adds parentheses, then the now-nested inner chain re-indents, so a
  caller should run `--fix` until the file stops changing;
  `no-mixed-operators` also parenthesizes same-precedence mixed-operator runs such as
  `a + b - c`, so in the combined config that case becomes `(a + b) - c` rather than a
  flattened chain.

## Usage

Reference the package in `oxlint.config.ts`:

```typescript
// oxlint.config.ts
import { defineConfig, } from 'oxlint';
export default defineConfig({
  jsPlugins: ['@monochromatic-dev/config-oxlint-stylistic',],
},);
```

## Design decisions

**Union/intersection types excluded**: a `union-per-line` rule was prototyped but dropped.
Inline type assertions like `Span & Record<string, unknown>` and `T | null | undefined`
generated too much noise to be worth enforcing.

**Blank-line rules excluded**: `lines-between-*`, `lines-around-*`, and `padding-line-between-*`
rules are intentionally out of scope.
Vertical whitespace stays with dprint plus local judgment;
this plugin enforces item boundaries and expression structure only.

**Minimum 2 items**: single-item constructs are never flagged.
An array with one element or a function with one parameter stays on one line.

**Shared implementation**: all rules delegate to `checkItemsPerLine` in the utility layer.
Each rule's visitor only extracts the relevant container and items from the AST,
keeping rule files minimal.

## Source files

- `index.ts`: plugin entry point; assembles all rules into the oxlint plugin object
- `rules/`: one file per rule, each exporting a `CreateOnceRule`
- `utility/item-per-line.ts`: shared detection and reporting logic
- `utility/item-per-line-fix.ts`: shared autofix logic (indentation detection, content rebuild)
- `utility/needs-fix.ts`: line-sharing detection between items and container delimiters
- `utility/delimiter.ts`: opening/closing delimiter scanning
- `utility/range.ts`: `rangeOf` and `at` helpers for untyped AST node access
- `utility/has-parens.ts`: source-level paren detection for `no-mixed-operators`
- `utility/chain.ts`: token-based grouping-paren detection, chain-root detection, and region/comment helpers for `chain-per-line`
- `utility/chain-flatten.ts`: computes a chain root's break offsets on decoupled operator and member axes for `chain-per-line`, walking each spine iteratively
- `utility/chain-render.ts`: break-point selection and canonical multi-line rendering for `chain-per-line`

## Tests

Fixture-based tests covering all rules plus autofix verification:

```bash
mise run buildAndTest -- packages/config/oxlint-stylistic/src/oxlint-stylistic.unit.test.ts
```

Test fixtures live in `packages/test-fixture/oxlint-stylistic/src/` with `valid/` and `invalid/` directories.
