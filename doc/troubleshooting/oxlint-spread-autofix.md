# Oxlint 1.85.0 `unicorn/no-useless-spread` and `unicorn/prefer-spread` safe fixes rewrite strings, typed arrays, and iterators into different values

## Symptom

`oxlint --fix` rewrites spreads and copies by method name,
without knowing the receiver type.
Plain `--fix` applies every rewrite,
and afterwards nothing reports the changed meaning.

`unicorn(no-useless-spread)` reports,
at error level through the `correctness` category:

```text
x unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily.
  help: `text.slice` returns a new array. Spreading it into an array expression to create a new array is redundant.
```

`unicorn(prefer-spread)` reports:

```text
Prefer the spread operator (`...`) over array.slice()
Prefer the spread operator (`...`) over Array.from()
```

Surface patterns and what `--fix` turns them into:

- `[...text.slice(0, 3)]` on a string becomes `text.slice(0, 3)`:
  a string instead of an array of code points
  (repo issue 563;
  TS2339 when `.some` follows).
- `[...scoopGrams.map(f)]` on a `Uint8Array` becomes `scoopGrams.map(f)`:
  a `Uint8Array`,
  so later values wrap at 256;
  silent when the type is inferred.
- `[...queue.filter(f)]` on an iterator helper becomes `queue.filter(f)`:
  a lazy iterator instead of an array.
- `Array.from(scoopGrams.map(f))` becomes `[...scoopGrams.map(f)]` through `prefer-spread`,
  then `scoopGrams.map(f)` through `no-useless-spread` on the next pass.
- `scoopGrams.slice()` on a typed array becomes `[...scoopGrams]`:
  `number[]` instead of a typed-array copy
  (repo issue 565).
- `text.slice()` on a string becomes `[...text]`,
  which `typescript(no-misused-spread)` then reports.

## Root cause

### `no-useless-spread` guesses "new array" from the method name

`is_functional_array_method` matches the name on any receiver,
`crates/oxc_linter/src/rules/unicorn/no_useless_spread/const_eval.rs:229-249`:

```rust
fn is_functional_array_method(call_expr: &CallExpression) -> bool {
    is_method_call(
        call_expr,
        None,
        Some(&[
            "concat", "copyWithin", "filter", "flat", "flatMap", "map",
            "slice", "splice", "toReversed", "toSorted", "toSpliced", "with",
        ]),
        None,
        None,
    )
}
```

`split` and `reduce(callback, [])` are classified the same way (`const_eval.rs:178-185`,
`:261-263`).
Only receivers written as `new Uint8Array(…)` or `Uint8Array.from(…)` are excluded (`const_eval.rs:154-172`),
so a typed array held in an identifier or property,
a string,
or an iterator is treated as an array.

### The dangerous-fix declaration does not reach the emitted fix

The rule declares itself `fix_dangerous`
(`crates/oxc_linter/src/rules/unicorn/no_useless_spread/mod.rs:146`),
but the clone check emits with `diagnostic_with_fix`
(`mod.rs:431-433`):

```rust
ctx.diagnostic_with_fix(clone(span, is_array, name), |fixer| {
    fix_by_removing_array_spread(fixer, &array_or_obj_span, spread_elem)
});
```

`diagnostic_with_fix` hard-codes the safe kind,
`crates/oxc_linter/src/context/mod.rs:306-311`:

```rust
pub fn diagnostic_with_fix<C, F>(&self, diagnostic: OxcDiagnostic, fix: F)
{
    self.diagnostic_with_fix_of_kind(diagnostic, FixKind::SafeFix, fix);
}
```

and whether a fix applies depends on the emitted fix's kind,
`context/mod.rs:519`:

```rust
if self.parent.fix.can_apply(rule_fix.kind()) && !rule_fix.is_empty() {
```

`DangerousFix` is `Dangerous | Fix` (`crates/oxc_linter/src/fixer/fix.rs:44`),
so a rule declared dangerous may still emit safe fixes,
and plain `--fix` applies them.
The declaration is metadata only.

### `prefer-spread` guesses arrays from spelling

The `slice` arm (`crates/oxc_linter/src/rules/unicorn/prefer_spread.rs:107-152`) skips array literals,
`this`,
literal receivers,
direct `new Uint8Array(…)`/`new ArrayBuffer(…)` constructions,
and the identifier names `arrayBuffer`,
`blob`,
`buffer`,
`file`,
and `this` (`:173`).
For any other identifier,
`is_not_array` (`:203-256`) follows a `const` initializer and otherwise falls back to capitalization:

```rust
if ident.starts_with(|c: char| c.is_ascii_uppercase())
    && ident.cow_to_ascii_uppercase() != ident
{
    return true;
}
false
```

A `new Uint8Array(4)` initializer reaches `_ => return false`,
so `const scoopGrams = new Uint8Array(4); scoopGrams.slice()` and a string parameter `text.slice()` are both rewritten.
The fix is emitted with `ctx.diagnostic_with_fix` (`prefer_spread.rs:265`),
a safe fix,
under a `conditional_fix` declaration (`:46`).

### An earlier reading that was wrong

The first diagnosis in repo issue 563 treated the problem as `.slice` alone on strings.
The catalog in "Verification" shows the same rewrite on typed-array `map` and iterator `filter`,
and the two-rule chain through `Array.from`,
so any fix limited to `slice` receivers leaves most failures in place.

## Verification

Oxlint 1.85.0 (`node_modules/.pnpm/oxlint@1.85.0_oxlint-tsgolint@7.0.2002`),
oxc source at commit `f51e678` (2026-09-25),
after the last commits to these rules
(`no_useless_spread`:
`03ef0f27b`,
2026-08-24;
`prefer_spread.rs`:
`feb733b5a`,
2026-09-22).

```json
// .oxlintrc.json
{
  "plugins": ["unicorn"],
  "categories": { "correctness": "off" },
  "rules": { "unicorn/no-useless-spread": "error", "unicorn/prefer-spread": "error" }
}
```

```ts
// catalog.ts
declare const text: string;
declare const scoopGrams: Uint8Array;
declare const queue: IteratorObject<number>;
declare const toppings: readonly string[];
declare const source: Iterable<number>;

export const codePoints = [...text.slice(0, 3,),];
export const doubled = [...scoopGrams.map(Number,),];
export const firstThree = [...queue.filter(Boolean,),];
export const fromTyped = Array.from(scoopGrams.map(Number,),);
export const scoopCopy = scoopGrams.slice();
export const codeCopy = text.slice();
export const toppingCopy = [...toppings.slice(0, 2,),];
export const fromArray = [...Array.from(source,),];
```

```sh
oxlint --fix catalog.ts
oxlint --fix catalog.ts
```

### Rewrites that keep behavior

- `[...toppings.slice(0, 2)]` becomes `toppings.slice(0, 2)`.
- `[...Array.from(source)]` becomes `[...source]`.

### Rewrites that change the value

`unicorn(no-useless-spread)`:

- `[...text.slice(0, 3)]` becomes `text.slice(0, 3)`.
- `[...scoopGrams.map(Number)]` becomes `scoopGrams.map(Number)`.
- `[...queue.filter(Boolean)]` becomes `queue.filter(Boolean)`.

`unicorn(prefer-spread)`:

- `scoopGrams.slice()` becomes `[...scoopGrams]`.
- `text.slice()` becomes `[...text]`.

Both,
across two passes:

- `Array.from(scoopGrams.map(Number))` becomes `scoopGrams.map(Number)`.

## Verified workarounds

### Project replacement rules with progressive type evidence

`no-restricted-syntax/no-useless-spread` and `no-restricted-syntax/prefer-spread`
(`package/oxlint-plugin/no-restricted-syntax/src/rule/`)
replace both upstream rules in `@monochromatic-dev/config-oxlint`.
They keep every upstream check whose fix syntax proves safe,
ask the TypeScript 7 semantic bridge about ambiguous receivers,
fix only proven arrays,
leave proven typed arrays and strings alone,
and report untyped ambiguous code without a fix.
Tests:
`package/oxlint-plugin/no-restricted-syntax/src/spread-rules.unit.test.ts`.
Tradeoffs:

- Files outside every tsconfig project,
  and `any`-typed receivers,
  get reports without fixes where upstream fixed.
- The bridge costs one TypeScript 7 process,
  shared with the readonly plugin through one bundled chunk.
- Like upstream,
  fixes on proven arrays assume dense arrays:
  `[...sparse]` fills holes that `sparse.slice()` keeps.

### Turning the upstream rules off

Removes every unsafe rewrite with no new code.
Tradeoff:
loses the checks that are always safe
(`[a, ...[b]]`,
`new Set([...x])`,
`[...Array.from(x)]`),
which the replacement keeps.

## What does not work

- Guidance text in the repo's oxlint wrapper
  (`package/dev-script/task-util/src/oxlint-guidance.ts`):
  the wrapper prints only the final lint after its fix loop
  (`package/dev-script/task-util/src/oxlint-wrapper.ts:254-277`),
  so an autofixed diagnostic and its guidance never reach the author.
- Disabling one rule's autofix:
  oxlint has only global `--fix`,
  `--fix-suggestions`,
  and `--fix-dangerously` flags;
  the editor-only `rulesCustomization.<rule>.autofix` setting does not affect the CLI.
- Rule options:
  neither `NoUselessSpread` nor `PreferSpread` reads configuration.
- Waiting for upstream PRs 26160 and 26615:
  both are unreviewed,
  and neither covers iterator helpers,
  `map`/`filter` on typed arrays held in identifiers,
  `split`,
  `reduce`,
  or the fix-kind mismatch.

## Upstream filing artifact

### Upstream filing decision

Pending the prototypes of the fix-kind change and the `prefer-spread` receiver check;
this section is completed when they report.
