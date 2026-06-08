# oxlint 1.65 `typescript/prefer-readonly-parameter-types` reports a branded primitive (`string & { __brand }`) nested in an object parameter, and `allow` cannot silence it, because the branded-literal exemption runs only on the top-level parameter type

`prefer-readonly-parameter-types` (run through tsgolint for `--type-aware`) flags a
parameter whose object property is a branded primitive such as
`CssValue = string & { readonly __cssValue: unique symbol }`,
 even though the brand is
deeply immutable.
 The same type passed as a bare parameter is not flagged.
 Adding the type
to the rule's `allow` option does not silence the nested case.
 This is working-as-intended
in both oxlint/tsgolint and typescript-eslint;
 the consumer-side remedy is a suppression in
the `task-oxlint` wrapper,
 not an `allow` entry or a source change.

## Symptom

`packages/webapp-productivity/done/src/client/mixins.ts` declares:

```typescript
import { cssRem, type CssValue, } from '@monochromatic-dev/module-hyperscript/ts';

export function focusOutline(
  { offset = cssRem(OUTLINE_WIDTH,), }: { readonly offset?: CssValue; } = {},
): CssDeclarations { /* ... */ }
```

Under `task-oxlint --type-aware` this reports:

```text
! typescript(prefer-readonly-parameter-types): Parameter should be a readonly type.
   ,-[src/client/mixins.ts:253:3]
253 |   { offset = cssRem(OUTLINE_WIDTH,), }: { readonly offset?: CssValue; } = {},
   :   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

`CssValue` is a branded readonly string,
 so the parameter is immutable;
 the report is a
false positive in the everyday sense.
 The trap is that it is narrow:

- A bare branded parameter `function f(x: CssValue,)` is NOT flagged.
- A plain readonly-string property `{ readonly s: string }` is NOT flagged.
- The branded primitive nested in ANY object-property shape IS flagged:
   optional
  `{ readonly offset?: CssValue }`,
   required `{ readonly offset: CssValue }`,
   and
  `Readonly<{ offset?: CssValue }>` all report.

`CssValue` is defined at `packages/module/hyperscript/src/css/values.ts:26`:

```typescript
export type CssValue = string & { readonly __cssValue: unique symbol; };
```

## Root cause

The rule special-cases branded primitives,
 but only at the top level of the parameter,
 not
inside the recursive readonly check.
 A branded primitive reached as a property type loses
the exemption and reports as mutable because the `string` half of the intersection carries
non-readonly methods.

Walk the chain in tsgolint (the engine oxlint drives for `--type-aware`).

1. The rule listener checks the brand exemption exactly once,
    on the whole parameter type,
   after the readonly recursion has already run and failed.
   `internal/rules/prefer_readonly_parameter_types/prefer_readonly_parameter_types.go:379`:

   ```go
   isReadOnly := isTypeReadonly(ctx.Program, ctx.TypeChecker, t, readonlynessOptions{
       allow:                  opts.Allow,
       treatMethodsAsReadonly: opts.TreatMethodsAsReadonly,
   })

   if !isReadOnly && !isTypeBrandedLiteralLike(ctx.TypeChecker, t) {
       // ... ctx.ReportNode(actualParameter, ...)
   }
   ```

   `t` here is the parameter type.
    For `f(x: CssValue)`,
    `t` is `CssValue`,
    so
   `isTypeBrandedLiteralLike(t)` returns true and the report is skipped.
    For
   `f(o: { readonly offset?: CssValue })`,
    `t` is the object,
    which is not a branded
   literal,
    so this top-level check does not apply.

2. `isTypeReadonly` recurses into property types and never consults the brand exemption.
   `internal/rules/prefer_readonly_parameter_types/prefer_readonly_parameter_types.go:202`
   (the recurser) calls `isTypeReadonlyObject`,
    which at line 175 recurses into each property
   value type via `isTypeReadonlyRecurser`.
    `isTypeBrandedLiteralLike` is referenced only in
   the listener (line 384),
    never inside `isTypeReadonlyRecurser`.
    So the `offset` property,
   typed `CssValue`,
    is recursed into as a raw `string & { __cssValue }` intersection.

3. The intersection reads as mutable because `string`'s methods are not `readonly`.
   `isTypeReadonlyObject` (line 133) iterates the apparent properties;
    with
   `treatMethodsAsReadonly: false` (our config),
    the inherited `string` methods (`charAt`,
   `slice`,
    and so on) are not marked readonly,
    so the first one returns
   `readonlynessMutable` (line 154).
    The property is mutable,
    the object is mutable,
    the
   parameter is reported.

typescript-eslint,
 which tsgolint ports,
 does the identical thing.
 The brand exemption is
checked once on the parameter type:
`packages/eslint-plugin/src/rules/prefer-readonly-parameter-types.ts` (the rule's `create`
return):

```typescript
const isReadOnly = isTypeReadonly(services.program, type, { allow, treatMethodsAsReadonly: !!treatMethodsAsReadonly });
if (!isReadOnly && !isTypeBrandedLiteralLike(type)) {
  context.report({ node: actualParam, messageId: 'shouldBeReadonly' });
}
```

`packages/type-utils/src/isTypeReadonly.ts` contains no reference to brands,
 tags,
 or
`isTypeBrandedLiteralLike` (grep returns nothing),
 so the recursion is brand-blind in both
engines.

### Why `allow` cannot silence the nested case

Every `allow` specifier form gates first on the type's alias or symbol name.
`internal/utils/type_matches_specifier.go:372`:

```go
func typeMatchesSpecifier(t *checker.Type, specifier TypeOrValueSpecifier, program *compiler.Program) bool {
    if !typeMatchesStringSpecifier(t, specifier.Name) {
        return false
    }
    // ... package/file/lib gate only runs after the name gate passes
}
```

`typeMatchesStringSpecifier` (line 146) matches against `Type_alias(t).Symbol().Name` or
`Type_symbol(t).Name`.
 When the rule recurses into the `offset` property,
 the resolved type
is the structural intersection `string & { __cssValue }` without the `CssValue` alias,
 so
the name gate compares against `["CssValue"]` and fails.
 The package and file gates never
run.
 Empirically,
 adding `'CssValue'` (name-only),
 and a
`{ from: 'package', package: '@monochromatic-dev/module-hyperscript', name: ['CssValue'] }`
specifier,
 both leave the parameter flagged (see Verification).

This is the same matcher family as the `$1` and `Root_` name-mismatch cases documented in
[oxlint-prefer-readonly-estree.md](oxlint-prefer-readonly-estree.md);
 there the declared
symbol name differs from the surface name,
 here the alias is dropped entirely during
recursion.
 typescript-eslint #11954 ("preserve type alias infomation",
 merged 2026-03-23)
improved alias preservation for top-level inlined unions,
 not for types reached as nested
property values.

## Verification

Versions under test:

- `oxlint` 1.65.0 (`node_modules/.bin/oxlint --version`),
   which drives tsgolint for
  `--type-aware`.
- tsgolint source read at commit `78f9a83` (2026-05-22),
   cloned to `/tmp/tsgolint`.
- typescript-eslint source read at commit `f891c29` (publish 8.60.0),
   cloned to
  `/tmp/typescript-eslint`.

Harness.
 A scratch module added inside the `done` package (whose tsconfig includes all
`src/**/*.ts`),
 then linted with `mise run //packages/webapp-productivity/done:lint:oxlint`:

```typescript
import type { H3, H3Event, HTTPEvent, } from 'h3';
import { type CssValue, } from '@monochromatic-dev/module-hyperscript/ts';

// CssValue = string & { readonly __cssValue: unique symbol }
export function reproBrandBare(x: CssValue,): void { void x; }                                 // passes
export function reproBrandWrappedOptional({ offset, }: { readonly offset?: CssValue; },): void { void offset; }   // FLAGGED
export function reproBrandWrappedRequired({ offset, }: { readonly offset: CssValue; },): void { void offset; }    // FLAGGED
export function reproBrandReadonlyMapped(o: Readonly<{ offset?: CssValue; }>,): void { void o; }                  // FLAGGED
export function reproPlainStringWrapped({ s, }: { readonly s: string; },): void { void s; }    // passes
export function reproControlMutable(a: { x: number; },): void { void a; }                      // FLAGGED (control: file is checked)
```

Patterns that pass (parameter not flagged):

- `reproBrandBare` (`x: CssValue`):
   top-level brand,
   exempted by `isTypeBrandedLiteralLike`.
- `reproPlainStringWrapped` (`{ readonly s: string }`):
   a plain `string` property is not an
  object type,
   so the recursion returns readonly immediately.

Patterns that fail (parameter reported):

- `reproBrandWrappedOptional`,
   `reproBrandWrappedRequired`,
   `reproBrandReadonlyMapped`:
   the
  branded primitive nested in any object-property shape.
- `reproControlMutable` (`{ x: number }`):
   a genuinely mutable object,
   confirming the file
  is type-checked (an early run with a `/* eslint-disable */` header silently suppressed the
  whole file and made every case look clean).

`allow` specifiers that do NOT silence `focusOutline` (still reported):

- `'CssValue'` (name-only),
   added to the rule's `allow` array.
- `{ from: 'package', package: '@monochromatic-dev/module-hyperscript', name: ['CssValue'] }`.

Both fail at the name gate,
 because the recursed property type carries no `CssValue` alias.

## Verified workarounds

### Wrapper suppression (chosen)

`task-oxlint` drops diagnostic blocks matching a hardcoded,
 documented signature and
recomputes the `Found N warnings and M errors.` summary.
 It converts oxlint's failure to
success only when every parsed block was suppressed,
 oxlint exited with its ordinary
diagnostics code (`1`),
 and stderr was empty;
 a config error or panic that coincides with a
suppressible block keeps the failure (`shouldForceSuccess` in
`packages/dev-script/task-util/src/oxlint-suppress.ts`).
That module ships one entry:

```typescript
{
  rule: 'prefer-readonly-parameter-types',
  snippetIncludes: 'CssValue',
  pathIncludes: 'src/client/mixins.ts',
  reason: '...',
}
```

This mirrors the source-filtering shape of
[tsgo-filter.ts](../../packages/dev-script/task-util/src/tsgo-filter.ts) (which already drops
node_modules and generated-i18n diagnostics).

Output format requirement.
 The block parser keys on oxlint's graphical reporter (a `!`/`x`
`plugin(rule):` header opening a multi-line block).
 oxlint's piped default reporter is not
stable across versions:
 1.65 emitted graphical-when-piped,
 1.67 emits a compact one-line
format (`path:line:col: severity plugin(rule): message`) that the parser cannot classify,
 so
nothing is suppressed and the `focusOutline` false positive fails the lint.
 `task-oxlint`
therefore pins `--format=default` before forwarding arguments (skipping the pin when the
caller passes an explicit `--format`/`-f`),
 so the parser always receives the graphical
blocks regardless of oxlint's version or TTY state.
 Verified by running
`mise run //packages/webapp-productivity/done:lint:oxlint`:
 without the pin on oxlint 1.67 it
exits `1` with the unsuppressed compact line;
 with the pin it exits `0` and reports
`Found 0 warnings and 0 errors.`

Tradeoffs:

- Invisible at the source site:
   a reader of `mixins.ts` sees no marker that the rule is
  suppressed for it.
   The reason string and this doc are the audit trail.
- Diverges from raw oxlint:
   a direct `oxlint` invocation (or CI not routed through
  `task-oxlint`) still reports the parameter.
   The repo runs lint through the wrapper,
   so the
  mise lint task is the boundary that matters.
- Substring match scoped by path:
   `snippetIncludes: 'CssValue'` also matches `'CssValueHelper'`,
  so the entry adds `pathIncludes: 'src/client/mixins.ts'` to confine the match to the sole
  flagged site.
   `focusOutline` is the only nested-`CssValue` parameter oxlint flags (verified
  by raw `oxlint --type-aware`:
   the package reports it,
   and the only other nested-`CssValue`
  shape,
   `touchTarget` in `module/hyperscript/src/css/index.unit.test.ts`,
   is not flagged).
   A
  `CssValue` token in any other file can no longer trip the match;
   a residual same-file
  collision (a real mutable param alongside a `CssValue` field in `mixins.ts` itself) remains
  possible but would surface as a visible failure,
   never hide a real one.

### Refactor to a top-level branded parameter (rejected here, valid in general)

`focusOutline(offset: CssValue = cssRem(OUTLINE_WIDTH))` puts `CssValue` at the top level,
where `isTypeBrandedLiteralLike` exempts it.
 Confirmed clean by `reproBrandBare`.
 Rejected
for `focusOutline` because it changes a pre-existing options-object signature to positional
and rewrites five call sites;
 the wrapper suppression keeps the API.
 This is the right
choice when the helper is new or already positional.

## What does not work

- `allow` in any specifier shape (name-only,
   `package`,
   `file`):
   the name gate compares
  against the recursed property type,
   which has dropped the `CssValue` alias.
   Verified above.
- `treatMethodsAsReadonly: true`:
   would pass the branded `string` methods,
   but it also
  silently passes legitimate `Set`/`Map`/class-state mutations (the reason
  `prefer-readonly-parameter-types.allow-lib.ts` whitelists `ReadonlyMap`/`ReadonlySet`
  explicitly instead of enabling it).
   Orthogonal and too broad.
- Redefining `CssValue` so it is not an intersection:
   a branded primitive is inherently
  `string & { brand }`,
   and the brand cannot be expressed without the intersection pulling
  in `string`'s non-readonly methods.
   There is no brand shape that avoids the recursion.

## Draft upstream issue

Do not file.
 The 5-constraint audit below concludes do-not-file because the behaviour is a
deliberate scope choice in both engines,
 with a maintainer rationale on record.

### Why we do not file this upstream

1. **Is it really upstream's fault?
   ** No. The top-level-only brand exemption is a deliberate
   scope decision.
    typescript-eslint issue #1790 (2020,
    "false positive with tagged primitive
   type") requested branded-primitive handling.
    Core maintainer bradzacher declined the
   general recursive case:
    "TS does not provide an API for us to remove a single type from an
   intersection ... our only real choice ... we won't be doing this for the general case.
   That being said,
    I am happy to accept a PR which handles the common case of a primitive
   and a single object.
   " PR #11660 (merged 2025-10-06,
    JoshuaKGoldberg) added
   `isTypeBrandedLiteralLike` for exactly that top-level case;
    all 14 of its added valid test
   cases are top-level branded parameters,
    none nested.
    Separately,
    issue #2823 ("false
   positives with nested object") is labeled "working as intended":
    "Your type is not deeply
   readonly ... You need to provide a deeply readonly type for the rule to be satisfied.
   "
   tsgolint faithfully ports this design.
2. **Can upstream fix it?
   ** Only with disproportionate change.
    Extending the exemption into
   the recursion is the "general case" bradzacher explicitly declined,
    and it would require
   the intersection-merging logic TypeScript provides no API for.
    Making `allow` match nested
   types would alter the name-gate contract for every rule and consumer.
3. **Are they supporting this use case?
   ** No. The rule docs
   (`packages/eslint-plugin/docs/rules/prefer-readonly-parameter-types.mdx`) document the
   `allow` option as the remedy for hard-to-readonly types and never mention "branded",
   "tagged",
    or "intersection".
    The branded exemption itself is undocumented.
4. **Will they likely fix it?
   ** No. The 2020 rationale,
    the deliberately top-level-only test
   surface in #11660,
    and the choice in #11954 to fix `allow` alias preservation rather than
   extend the exemption all point to "by design.
   " No commits move toward nested-brand
   handling.
5. **Have we prototyped a minimal fix?
   ** Not applicable.
    Constraints 1 and 4 fail,
    so the
   auto-prototype path is not triggered.
    The correct fix is consumer-side (the wrapper
   suppression above),
    which resolves the user-facing problem without upstream change.

Kept draft,
 in case upstream signal changes:

~~~md
Title: `prefer-readonly-parameter-types` branded-literal exemption is not applied to
branded primitives nested in object parameters

Labels: enhancement, rule, type-aware

`isTypeBrandedLiteralLike` (added in #11660 for #1790) exempts a branded primitive only when
it is the top-level parameter type. A branded primitive nested in an object property
(`function f(o: { readonly offset?: CssValue })` where `CssValue = string & { __brand }`) is
still reported, because `isTypeReadonly` recurses into the property as the raw intersection
and the `string` half carries non-readonly methods. `allow` cannot target it either: the
recursed property type drops the alias, so the name gate in
`typeMatchesSpecifier`/`specifierNameMatches` never matches.

Reproduction: `function f(x: CssValue)` passes; `function f(o: { readonly offset?: CssValue })`
reports; adding `CssValue` to `allow` does not help.

Suggested change (a scope expansion, not a bug fix): consult `isTypeBrandedLiteralLike`
inside the `isTypeReadonly` property recursion, or preserve the alias on recursed property
types so `allow` can match. Both touch the readonly-recursion core that #1790 declined to
extend. Code locations: typescript-eslint
`packages/eslint-plugin/src/rules/prefer-readonly-parameter-types.ts`,
`packages/type-utils/src/isTypeReadonly.ts`,
`packages/type-utils/src/isTypeBrandedLiteralLike.ts`; tsgolint
`internal/rules/prefer_readonly_parameter_types/prefer_readonly_parameter_types.go`,
`internal/utils/type_matches_specifier.go`.
~~~
