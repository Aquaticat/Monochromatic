# Planning: invocation-depth-per-line stylistic rule

Status: implemented in `packages/oxlint-plugins/stylistic`
(`src/rules/invocation-depth-per-line.ts`, `src/utility/invocation-spine.ts`,
`src/utility/invocation-depth-fix.ts`); enabled `warn` in
`packages/config/oxlint/src/rules/style.ts`.

This file records the full grilling session that produced the `invocation-depth-per-line` rule.
A future implementer should be able to read only this file and recover the problem statement,
the evidence gathered, every design branch we settled, the corrections made along the way,
and the final implementation target.

## Implementation spec

This section is the implementation checklist.
The decision trace below records why each choice was made;
an implementer can work from this section alone and drop to the trace for rationale.

### Identity

- Package: `packages/oxlint-plugins/stylistic`; new rule file under `src/rules/`, registered in `src/index.ts`.
- Config key `stylistic/invocation-depth-per-line`, enabled `warn` in `packages/config/oxlint/src/rules/style.ts`.
- `meta.type: 'layout'`, `meta.fixable: 'whitespace'`. A trailing-comma-inserting reformat is still declared
  `whitespace` in this repo (`src/rules/argument-per-line.ts:36-38`), so the comma the fixer adds does not change this.
- Threshold: hardcoded maximum of two counted invocations per source line.

### Semantics

A source line fails when one checked operand spine has more than two counted invocation heads starting on that line.
Threshold-only: already-split layouts pass when every line stays within two.

### Counted invocation heads

- `CallExpression` (including optional calls) and `NewExpression`: the spine continues through the single argument
  only when `arguments.length === 1`.
- `ImportExpression`: the spine operand is `.source`, not `.arguments[0]`, and continues only when `.options` is null
  (the `@oxlint/plugins` `ImportExpression` interface carries `source`, `options`, `phase`).
- Do not count `TaggedTemplateExpression`, JSX, or `V8IntrinsicExpression`. The oxc parser as invoked here does not
  emit `V8IntrinsicExpression` for repo TypeScript, so it needs no explicit exclusion code.

### Transparent wrappers (spine passes through)

`ChainExpression`, `AwaitExpression`, `UnaryExpression`, `YieldExpression`, `SpreadElement`, `TSAsExpression`,
`TSSatisfiesExpression`, `TSTypeAssertion`, `TSNonNullExpression`, `TSInstantiationExpression`.

Not `ParenthesizedExpression`. oxlint strips grouping parentheses and emits no such node here
(`src/utility/chain.ts` `parenIsolated`, `src/utility/has-parens.ts` `hasParens`), even though the `@oxlint/plugins`
type union declares the type and a visitor hook for it. Confirmed empirically on oxlint 1.67.0 (see "Verification"):
`a((b(c())))` parses to three `CallExpression` nodes with no paren node, so detection is unaffected. The autofix is
affected: see the paren note under "Autofix".

### Containers (stop the parent spine, descendants still checked)

`ObjectExpression`, `ArrayExpression`, `ConditionalExpression`, `SequenceExpression`, `AssignmentExpression`,
`TemplateLiteral`, `TaggedTemplateExpression`, and function bodies (`ArrowFunctionExpression`, `FunctionExpression`).
A container stops the parent spine, but normal visitors still check spines that live inside it (decisions 29, 32).

### Autofix

- One report fixes one level: split the reported invocation's single operand onto its own line, dedent the closing
  delimiter to the source-line indent, always add a trailing comma.
- Deep spines converge over repeated `oxlint --fix` passes rather than expanding fully in one pass
  (`docs/troubleshooting/oxlint-multi-fix-convergence.md`). Tests must include a convergence fixture.
- Build the replacement with the bracket-locating, offset-slicing approach in `src/utility/item-per-line-fix.ts`,
  never `getText(item).trim()`, so trailing comments and inner formatting survive.
- Place the trailing comma before trailing line and block comments.
- Grouping parens: operand spans exclude surrounding parens (`has-parens.ts:17`), so slicing `[operand.start,
  operand.end]` drops them. Recover the grouping bytes with the `parenIsolated`/`hasParens` byte-peek before slicing,
  or the fix silently deletes the parentheses.
- Do not rewrite tagged-template quasis (it changes the tag's observed `strings.raw`); fix only inside `${...}`.

### Diagnostic ownership

Report the highest counted invocation on each line whose spine count exceeds two.
Independent spines report independently: `a(b(c(x())), d(e(f())))` yields two diagnostics, one on `b` and one on `d`,
because the two-argument `a` breaks both spines.

### Traversal

Iterative, never recursive: spine depth grows with source length and the repo bans recursion over linear input.
Before coding, dump node types with a throwaway logging visitor for each fixture shape (call, new, dynamic import,
optional call, grouping parens, spread, yield, unary, TS wrappers, tagged-template interpolation) to confirm the shapes
against the running oxlint version rather than against the type union.

### Verification

Confirmed on oxlint 1.67.0 with a throwaway probe plugin reporting each visited node's type.
For `const grouped = a((b(c())));` the probe reported three `CallExpression` nodes and no `ParenthesizedExpression`,
and the `b(c())` operand span excluded the surrounding parens, so the byte-peek paren recovery above is required.
`import(...)` surfaced as an `ImportExpression` operand; `await`, `void`, `yield`, and spread surfaced as
`AwaitExpression`, `UnaryExpression`, `YieldExpression`, and `SpreadElement` wrappers.
Re-run the probe after any oxlint major bump.

## Starting proposal

The starting proposal was narrower than the final rule:

```txt
Plan to implement nested-call-per-line (or similar) rule:
  1. Fire on a CallExpression whose single argument is itself a CallExpression,
     or an AwaitExpression wrapping one.
  2. gated on depth 2.
```

The session used the `grill-me` process: ask one design question at a time,
explore the codebase for answerable questions instead of asking, and recommend one answer for each branch.

## Evidence gathered during grilling

The first codebase search found the custom syntax-rule package:

- `packages/oxlint-plugins/no-restricted-syntax/src/index.ts` registers custom no-restricted-syntax rules.
- `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`
  shows fixture-driven rule tests for that package.

A later search showed this new rule belongs in the stylistic package instead:

- `packages/oxlint-plugins/stylistic/src/index.ts` registers layout and expression-structure rules.
- `packages/oxlint-plugins/stylistic/src/rules/argument-per-line.ts` enforces one argument per line
  for calls and constructors with two or more arguments.
- `packages/oxlint-plugins/stylistic/src/rules/param-per-line.ts` enforces one parameter per line
  for function-like declarations with two or more parameters.
- `packages/oxlint-plugins/stylistic/src/rules/chain-per-line.ts` enforces receiver, member,
  call-result, binary, and logical chain layout.
- `packages/config/oxlint/src/rules/style.ts` enables stylistic plugin rules as `warn`.

The Oxlint ESTree type definitions in
`node_modules/.pnpm/@oxlint+plugins@1.58.0/node_modules/@oxlint/plugins/index.d.ts`
showed the relevant node shapes:

- `CallExpression` carries `callee`, `arguments`, and `optional`.
- `NewExpression` carries `callee` and `arguments`.
- `ImportExpression` carries `source`, optional `options`, and optional `phase`.
- `TaggedTemplateExpression` carries `tag` and `quasi`.
- `ChainExpression`, `ParenthesizedExpression`, `AwaitExpression`, `UnaryExpression`, `YieldExpression`,
  `SpreadElement`, `TSAsExpression`, `TSSatisfiesExpression`, `TSTypeAssertion`, `TSNonNullExpression`,
  and `TSInstantiationExpression` provide wrapper shapes the rule may need to pass through.

A repo source search found no active `.tsx` or `.jsx` files.
That supported excluding JSX pseudo-call semantics from the first implementation.

A Node check showed that rewriting a tagged template from `` tag`${value}` `` to a multiline template body changes
`strings.raw`, so tag-quasi rewriting is not semantics-preserving.
That forced the later tagged-template decision.

The existing troubleshooting doc `docs/troubleshooting/oxlint-multi-fix-convergence.md` records that Oxlint may need
multiple `--fix` passes when plugin fixes overlap.
The new rule may overlap with `argument-per-line`, so the implementation and tests should assume convergence,
not single-pass completion.

## Session decision trace

This section records each decision in the order it was made.
When a later branch corrected an earlier branch, the correction is called out explicitly.

### 1. Rule semantics: line-sensitive, not structural

Options considered:

- Line-sensitive formatting rule.
- Structural ban on nested single-argument calls.
- Formatter-only behavior.

Chosen: line-sensitive.

Reason: the rule is about per-line readability. A structural ban would reject already-readable multiline code.
Formatter-only behavior would not provide a targeted diagnostic or threshold-specific enforcement.

```ts
// FAIL
const value = parse(readConfig());

// PASS
const value = parse(
  readConfig(),
);
```

### 2. Correction: depth two is allowed

The first examples treated `a(b())` as a failure.
That was wrong.
The intended threshold is "calls greater than two must be split".

Resolved rule:

```ts
// PASS: exactly two counted invocations.
const value = a(b());

// FAIL: three counted invocations on one line.
const value = a(b(c()));
```

This correction also explained why the rule targets one-operand call composition:
`argument-per-line` already owns multi-argument call layout.

### 3. Split shape: max two counted invocations per line

Options considered:

- Max two counted invocations per line.
- Full cascade split.
- Outer-only split.

Chosen: max two counted invocations per line.

```ts
// FAIL
const value = a(b(c()));

// PASS: no line contains more than two counted invocations.
const value = a(
  b(c()),
);

// PASS: depth two is allowed.
const value = a(b());
```

Full cascade was stricter than the user asked for.
Outer-only split did not define a durable invariant for longer chains.

### 4. First wrapper decision: await plus TypeScript wrappers

Options considered:

- Await only.
- Await plus TypeScript wrappers.
- Plain calls only.

Chosen: await plus TypeScript wrappers.

```ts
// FAIL
const value = a(await b(c()));

// PASS
const value = a(
  await b(c()),
);

// FAIL
const value = a(b(c()) as Value);

// PASS
const value = a(
  b(c()) as Value,
);
```

This choice was later expanded into the full transparent-wrapper list.

### 5. Invocation scope: broader than `CallExpression`

Options considered:

- `CallExpression` plus `NewExpression`.
- `CallExpression` only.
- All invocation-like forms.

Chosen by user: all invocation-like forms.

The follow-up codebase and type-definition check narrowed that to a practical TypeScript set:

- Count `CallExpression`.
- Count `NewExpression`.
- Count `ImportExpression`.
- Do not include V8 intrinsics in the first implementation.
- Do not include JSX in the first implementation.

Tagged templates were initially considered part of the practical set,
but later decisions changed their status.

### 6. Long-chain autofix shape: outer-first

Options considered:

- Outer-first recursive split.
- Head-pair split.
- Full cascade split.

Chosen: outer-first recursive split as the autofix shape.

```ts
// FAIL
const value = a(b(c(d())));

// PASS after autofix
const value = a(
  b(
    c(d()),
  ),
);
```

This is an autofix preference, not the lint invariant.
The shown layout is the converged state: each report splits one operand level, so a spine this deep needs several
`oxlint --fix` passes (one pass on `a(b(c(d())))` yields `a(\n  b(c(d())),\n)`, still failing).
The later threshold-only decision means hand-written alternatives pass if every line stays at depth two or less.

### 7. Autofix scope: full autofix

Options considered:

- Conservative autofix.
- Full autofix.
- Report-only.

Chosen: full autofix.

```ts
// FAIL
const value = a(b(c()));

// PASS after fix
const value = a(
  b(c()),
);
```

Later branches refined this: full autofix applies to fixable invocation spines,
but tagged-template quasis must not be rewritten because doing so changes runtime semantics.

### 8. Nesting path: operand spine

Options considered:

- Invocation operand spine.
- Any descendant invocation.
- Direct call arguments only.

Chosen: operand spine.

```ts
// FAIL
const value = a(b(c()));

// PASS
const value = a(
  b(c()),
);

// PASS: object literal breaks the parent operand spine.
const value = a({ value: b(c()) });
```

The later container decision kept the parent-spine break but still checks descendants inside containers independently.

### 9. Arity gate: strict single operand

Options considered:

- Strict single operand.
- Per-operand branch checking in multi-operand parents.
- Total line count across sibling operands.

Chosen: strict single operand for traversing through the current invocation.

```ts
// FAIL for invocation-depth-per-line.
const value = a(b(c()));

// PASS for invocation-depth-per-line: `a` has two arguments, so `a` does not continue the spine.
// `argument-per-line` owns the parent call layout.
const value = a(b(c()), other);
```

Later refinement: single-operand child spines inside multi-argument parents still get checked.
That means `b(c(d()))` inside `a(b(c(d())), other)` is still owned by `invocation-depth-per-line`.

### 10. Diagnostic ownership, first pass: outermost over-depth spine

Options considered:

- Outermost only.
- Every violating node.
- Innermost only.

Chosen at this stage: outermost only.

The reason was to avoid overlapping diagnostics inside one uninterrupted over-depth spine.
This was later refined by the threshold-only and owner-line decisions:
report the highest invocation on the line that actually violates the threshold.

### 11. Rule name

Options considered:

- `max-invocation-depth-per-line`.
- `invocation-depth-per-line`.
- `nested-invocation-per-line`.
- `nested-call-per-line`.

Chosen: `invocation-depth-per-line`.

Reason: it names the broader invocation scope without making the rule name too long.

### 12. Rule package and enablement

Resolved from codebase evidence:

- Put the rule in `packages/oxlint-plugins/stylistic`.
- Register it in `packages/oxlint-plugins/stylistic/src/index.ts`.
- Enable it as `stylistic/invocation-depth-per-line: 'warn'` in
  `packages/config/oxlint/src/rules/style.ts`.

It does not belong in `oxlint-no-restricted-syntax` because it is a layout rule with a whitespace autofix.

### 13. Canonical layout: threshold-only, not outer-first enforcement

Options considered:

- Enforce outer-first canonical layout.
- Threshold-only layout.

Chosen: threshold-only.

```ts
// PASS: no line has more than two counted invocations.
const value = a(b(
  c(),
));

// PASS: autofix may produce this shape, but lint does not require it.
const value = a(
  b(c()),
);

// FAIL: three counted invocations on one line.
const value = a(b(c()));
```

This separated the lint invariant from the autofix renderer's preferred output.

### 14. Line attribution: invocation-head line

Options considered:

- Invocation head line.
- Wrapper start line.
- Whole-span overlap.

Chosen: invocation head line.

```ts
// FAIL: a, b, and c heads start on line 1.
const value = a(await b(c()));

// PASS: c starts on its own line.
const value = a(await b(
  c(),
));
```

Whole-span overlap would make compliant multiline code fail because outer invocations span child lines.
Wrapper start would overcount syntax like `await` and type assertions.

### 15. Callee chains: out of scope

Options considered:

- Operand only.
- Include callee position.
- Count every invocation chain.

Chosen: operand only.

```ts
// FAIL: operand spine.
const value = a(b(c()));

// PASS for this rule: callee chain.
const value = factory()()();
```

`chain-per-line` remains the owner for receiver and call-result chains.

### 16. Dynamic import and tag single-operand rules

For dynamic import, strict single operand means the rule traverses through `import(source)`
but not `import(source, options)`.

```ts
// FAIL
const value = a(import(b(c())));

// PASS
const value = a(
  import(b(c())),
);

// PASS for this rule.
const value = a(import(b(c()), opts));
```

Tagged-template handling changed later and no longer follows the counted-invocation path.

### 17. Full transparent-wrapper list

After checking Oxlint's node types, the wrapper list expanded beyond the initial await plus TypeScript wrappers.

Chosen transparent wrappers (`ParenthesizedExpression` was later removed; see "Implementation spec"):

- `ChainExpression`.
- `AwaitExpression`.
- TypeScript wrappers: `TSAsExpression`, `TSSatisfiesExpression`, `TSTypeAssertion`,
  `TSNonNullExpression`, and `TSInstantiationExpression`.

```ts
// FAIL
const value = a((b(c())));

// PASS
const value = a(
  (b(c())),
);

// FAIL
const value = a(b?.(c()));

// PASS
const value = a(
  b?.(c()),
);
```

Semantic unary, yield, and spread were not decided until later branches.

### 18. Folding into `chain-per-line`: rejected

The user asked whether the rule should exist separately or fold into `chain-per-line`.

Evaluation:

- `chain-per-line` currently descends through `CallExpression.callee`, not `CallExpression.arguments`.
- `chain-per-line` treats `new` and tagged templates as leaves.
- `chain-render.ts` inserts newline breaks at offsets; it does not re-render call argument lists with commas.
- Folding would turn `chain-per-line` into an umbrella rule with a mostly separate invocation-depth subsystem.

Decision: keep `invocation-depth-per-line` separate.

### 19. Tagged templates: do not rewrite quasis

The first full-autofix examples rewrote:

```ts
const value = a(tag`${b(c())}`);
```

into a multiline tagged template body.
A Node check showed that such a rewrite changes the tag's observed template strings.

Options considered:

- Preserve tag quasis and split inside interpolation expressions.
- Report-only for tag cases.
- Rewrite quasis anyway.

The user first chose report-only for tags, then clarified that tagged template literal syntax should be transparent or ignored
because the repo does not use tagged template literals.
The final settled behavior is:

- Do not count `TaggedTemplateExpression` itself.
- Let tag syntax break the parent operand spine.
- Still check and autofix normal call spines inside `${...}` interpolation expressions.
- Do not rewrite template quasis.

```ts
// PASS: tag wrapper breaks the outer spine, and b(c()) is only depth two.
const value = a(tag`${b(c())}`);

// FAIL: interpolation descendant b(c(d())) is checked independently.
const value = a(tag`${b(c(d()))}`);

// PASS: fix happens inside the interpolation expression without changing quasis.
const value = a(tag`${b(
  c(d()),
)}`);
```

### 20. Multi-argument parent interaction: scan child spines

Options considered:

- Scan single-operand child spines inside multi-argument parents.
- Skip children under multi-argument parents.
- Only check root calls.

Chosen: scan children.

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
```

### 21. Overlapping autofixes: fix and converge

Options considered:

- Provide autofixes and rely on repeated `oxlint --fix` convergence.
- Report-only when a child fix overlaps another rule's fix.
- Suppress the child diagnostic.

Chosen: fix and converge.

This matches the existing documented Oxlint limitation:
when fixes overlap, a later pass may be needed.
Tests should include a convergence fixture rather than requiring one-pass stability.

### 22. Semantic unary operators: transparent

Options considered:

- Semantic unary breaks the spine.
- Semantic unary is transparent.
- Only `void` is transparent.

Chosen: semantic unary is transparent.

```ts
// FAIL
const value = a(void b(c()));

// PASS
const value = a(
  void b(c()),
);

// FAIL
const value = a(!b(c()));

// PASS
const value = a(
  !b(c()),
);
```

This makes the rule follow visible invocation density, not only value-preserving wrappers.

### 23. `yield` and `yield*`: transparent

Options considered:

- Treat `yield` and `yield*` as transparent.
- Break the spine at `yield`.

Chosen: transparent yield.

```ts
// FAIL
function* gen(): Generator<unknown> {
  const value = a(yield b(c()));
}

// PASS
function* gen(): Generator<unknown> {
  const value = a(
    yield b(c()),
  );
}
```

### 24. Spread: transparent

Options considered:

- Single spread argument is transparent.
- Spread breaks the spine.

Chosen: transparent spread.

```ts
// FAIL
const value = a(...b(c()));

// PASS
const value = a(
  ...b(c()),
);

// FAIL
const value = new A(...b(c()));

// PASS
const value = new A(
  ...b(c()),
);
```

### 25. Threshold configuration: hardcode two

Options considered:

- Hardcode max depth two.
- Make the threshold configurable.

Chosen: hardcode two.

Reason: the repo has one style target, and existing stylistic rules hardcode their thresholds.
A configurable option would add schema and test complexity without an identified second threshold.

### 26. Trailing comma: always add

Options considered:

- Always add a trailing comma when splitting the single operand.
- Preserve whether a trailing comma existed.
- Never add a trailing comma.

Chosen: always add.

```ts
// FAIL
const value = a(await b(c()));

// PASS after fix
const value = a(
  await b(c()),
);
```

This matches the repo's multiline call style.

### 27. Line comments: move comma before comment

Options considered:

- Report-only for line-comment operands.
- Move the comma before the trailing comment.
- Put the comma on its own next line.

Chosen: move comma before the trailing comment.

```ts
// FAIL
const value = a(b(c()) // keep
);

// PASS after fix
const value = a(
  b(c()), // keep
);
```

### 28. Block comments: comma before comment

Options considered:

- Put the comma before trailing block comments.
- Put the comma after trailing block comments.

Chosen: comma before trailing block comments, matching the line-comment decision.

```ts
// FAIL
const value = a(b(c()) /* keep */);

// PASS after fix
const value = a(
  b(c()), /* keep */
);
```

### 29. Container descendants: check inside, do not cross containers

Options considered:

- Containers break the parent spine, but descendants inside containers are checked independently.
- Containers suppress all descendant checks.
- Cross containers and count every descendant.

Chosen: check inside.

```ts
// PASS: object breaks a -> b, and b(c()) is only depth two.
const value = a({ value: b(c()) });

// FAIL: inner b(c(d())) is checked independently.
const value = a({ value: b(c(d())) });

// PASS
const value = a({ value: b(
  c(d()),
) });
```

### 30. Indentation: source-line indent plus two spaces

Options considered:

- Base indentation of the invocation source line plus two spaces.
- Align continuation to the call-head column.

Chosen: source-line indent plus two spaces.

```ts
// FAIL
  const value = a({ value: b(c(d())) });

// PASS after fix
  const value = a({ value: b(
    c(d()),
  ) });
```

This matches existing stylistic helper behavior better than wide column alignment.

### 31. Owner line: highest invocation on the bad line

Options considered:

- Highest invocation on the line whose counted depth exceeds two.
- Original spine root.
- Innermost pair.

Chosen: highest invocation on the bad line.

```ts
// FAIL: diagnostic on a(...), because line 1 has a + b + c.
const value = a(b(c()));

// FAIL: diagnostic on b(...), because line 2 has b + c + d.
const value = a(
  b(c(d())),
);
```

Independent spines on one line report independently:

```ts
// FAIL: two diagnostics, one on b and one on d; the two-argument a breaks both spines.
const value = a(b(c(x())), d(e(f())));
```

This reconciles threshold-only layout with stable diagnostic ownership.

### 32. Multiple independent spines and containers

The user initially chose "one per root" for multiple independent spines in one line.
That preview implied `invocation-depth-per-line` might rewrite object literals broadly.
A follow-up pointed out that existing container rules already own object layout.

Final decision: container rules own container layout.
`invocation-depth-per-line` owns invocation spines inside containers.
It may report independently fixable child spines, and the combined formatter/linter pass converges with existing container rules.

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

### 33. Final confirmation

The final spec was read back to the user and confirmed as correct.
The confirmed summary became the implementation target below.

## Final rule identity

- Package: `packages/oxlint-plugins/stylistic`.
- Rule name: `invocation-depth-per-line`.
- Config key: `stylistic/invocation-depth-per-line`.
- Default severity: `warn`.
- Fixability: `fixable: 'whitespace'` for fixable cases.
- Threshold: hardcoded maximum of two counted invocations per source line.

## Final rule semantics

The rule checks invocation operand spines.
A source line fails when one checked spine contains more than two counted invocations whose invocation heads start on that line.

```ts
// PASS
const value = a(b());

// FAIL
const value = a(b(c()));

// PASS
const value = a(
  b(c()),
);
```

The rule is threshold-only.
Already-split layouts pass when every line stays within the depth limit.

```ts
// PASS
const value = a(b(
  c(),
));
```

## Final counted nodes

Count these invocation heads:

- `CallExpression`, including optional calls.
- `NewExpression`.
- `ImportExpression` when traversed through its source operand.

Do not count these in the first implementation:

- `TaggedTemplateExpression` as a wrapper itself.
- V8 intrinsic expressions.
- JSX elements or components.

## Final transparent wrappers

The operand-spine walker passes through these node types:

- `ChainExpression`.
- `AwaitExpression`.
- `UnaryExpression`.
- `YieldExpression`.
- `SpreadElement`.
- `TSAsExpression`.
- `TSSatisfiesExpression`.
- `TSTypeAssertion`.
- `TSNonNullExpression`.
- `TSInstantiationExpression`.

It does not pass through `ParenthesizedExpression`: oxlint strips grouping parentheses and emits no such node here
(`src/utility/chain.ts` `parenIsolated`, `src/utility/has-parens.ts` `hasParens`), so the wrapper is unnecessary and
`a((b(c())))` already parses as depth-three `a(b(c()))`. The autofix must still recover grouping bytes by byte-peek,
because operand spans exclude surrounding parens. Re-confirm this against the running oxlint version, since the
`@oxlint/plugins` type union does declare a `ParenthesizedExpression` node and a visitor hook for it.

The walker does not pass through containers: `ObjectExpression`, `ArrayExpression`, `ConditionalExpression`,
`SequenceExpression`, `AssignmentExpression`, `TemplateLiteral`, `TaggedTemplateExpression`, and function bodies
(`ArrowFunctionExpression`, `FunctionExpression`).
Those containers stop the parent spine, but normal visitors still check descendants inside them.

## Final autofix rules

For a fixable violating invocation, replace the invocation's argument or operand list with a multiline form:

```ts
// FAIL
const value = a(b(c()));

// PASS after fix
const value = a(
  b(c()),
);
```

The fixer:

- Uses source-line indentation plus two spaces for the operand line.
- Returns the closing delimiter to the source-line indentation.
- Always adds a trailing comma.
- Places the trailing comma before trailing line comments.
- Places the trailing comma before trailing block comments.
- Does not rewrite tagged-template quasis.
- Allows overlapping fixes with other rules and relies on repeated `oxlint --fix` convergence.

## Implementation outline

Implement the rule as a new file under `packages/oxlint-plugins/stylistic/src/rules/`.
Register it in `packages/oxlint-plugins/stylistic/src/index.ts`.
Enable it in `packages/config/oxlint/src/rules/style.ts`.

Use iterative traversal, not recursion.
Invocation nesting depth can grow with source length.
Recursing over an operand spine would violate the repo rule against recursion over linear input and risks stack overflow.

A workable internal model:

1. Visit `CallExpression`, `NewExpression`, and `ImportExpression`.
2. For each visited counted invocation, determine whether it is the highest counted invocation on its source line.
3. Walk the single-operand spine iteratively, passing through transparent wrappers.
4. Track counted invocation heads by source line.
5. If any line reaches three counted invocations, report the highest invocation on that line.
6. Build a fix by splitting that invocation's single operand, when the target syntax is fixable.

The implementation should compute invocation-head lines rather than using whole-node span overlap.
Whole-node overlap would treat compliant multiline calls as violations because outer call spans include child lines.

## Test coverage

Add invalid fixtures for:

- Plain calls: `a(b(c()))`.
- Constructors: `new A(b(c()))` and `a(new B(c()))`.
- Optional calls: `a(b?.(c()))`.
- Dynamic import with one operand: `a(import(b(c())))`.
- Transparent wrappers: `await`, unary, `yield`, spread, parentheses, and TypeScript wrappers.
- Already-split child-line violation: `a(\n  b(c(d())),\n)`.
- Descendant spines inside containers.
- Descendant spines inside tagged-template interpolations.
- Comment-aware autofix for trailing line comments.
- Comment-aware autofix for trailing block comments.
- Overlap convergence with `argument-per-line` on `a(b(c(d())), other)`.

Add valid fixtures for:

- Depth two: `a(b())`.
- Threshold-only noncanonical split: `a(b(\n  c(),\n))`.
- Callee chains: `factory()()()`.
- Multi-argument parent with depth-two child: `a(b(c()), other)`.
- Dynamic import with options: `a(import(b(c()), opts))`.
- Tagged-template wrapper with depth-two interpolation: `` a(tag`${b(c())}`) ``.
- Container parent with depth-two descendant: `a({ value: b(c()) })`.

Add autofix convergence tests for cases where `invocation-depth-per-line` overlaps with:

- `argument-per-line`.
- `object-property-per-line`.
- `array-element-per-line`, if an array fixture contains multiple child spines.
