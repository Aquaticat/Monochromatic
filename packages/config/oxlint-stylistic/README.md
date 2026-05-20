# @monochromatic-dev/config-oxlint-stylistic

Oxlint JS plugin for TypeScript stylistic rules:
one-item-per-line formatting across multi-element constructs,
and explicit operator structure in nested expressions.

The per-line rules fire when 2 or more items share a source line
and auto-fix by placing every item on its own line with consistent indentation.
They work alongside dprint's `preferHanging: "always"` setting,
which formats multi-line items correctly but does not force them to be multi-line.

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

### Expression structure

- **no-mixed-operators**: require parentheses around nested binary or logical expressions
  whose operator differs from the parent.
  Same-operator chains (`a + b + c`, `x && y && z`) are permitted because they are unambiguous under associativity.
  Mixed operators (`a + b * c`, `x || y && z`) must be disambiguated with explicit parens.
  Not auto-fixable.
- **chain-per-line**: require one chain segment per source line for binary, logical,
  member, and call chains.
  Reports when:
  - a binary/logical chain has 2 or more same-operator boundaries on a single line, OR
  - a member/call chain has 2 or more call boundaries (method chain) or 3 or more member
    boundaries (deep access) on a single line.
  Common idioms stay on one line: `obj.method()`, `obj.foo.bar`,
  `context.sourceCode.getText()`, `arr[0][1]`.
  Multi-step patterns split: `arr.map(f).filter(g)`, `obj.a.b.c`,
  `foo().bar().baz()`.
  Covers `BinaryExpression`, `LogicalExpression`, `MemberExpression`, `CallExpression`,
  including optional chaining (`?.`), computed access (`a[b]`), call chains (`f().g()`),
  TypeScript type arguments (`a.b<T>().c`), and right-associative `**`.
  Source-level parens isolate inner chains (`(a + b) + c` keeps `(a + b)` opaque).
  Same-operator chains are walked because `no-mixed-operators` already wrapped any
  mismatched precedence.
  Auto-fix inserts `\n + indent` before each member-frame boundary token, following the
  project's break-before continuation style; call boundaries stay attached to the
  preceding member. The fix is suppressed when an inter-segment slice contains a comment
  or other foreign content.
  Tagged templates (`` tag`x` ``) and `new` expressions are treated as opaque leaves
  rather than chain participants.

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
- `utility/has-parens.ts`: source-level paren detection shared between `no-mixed-operators` and `chain-per-line`
- `utility/chain.ts`: chain-root predicates, chain walkers, boundary-token finders for `chain-per-line`

## Tests

Fixture-based tests covering all rules plus autofix verification:

```bash
mise run buildAndTest -- packages/config/oxlint-stylistic/src/oxlint-stylistic.unit.test.ts
```

Test fixtures live in `packages/test-fixture/oxlint-stylistic/src/` with `valid/` and `invalid/` directories.
