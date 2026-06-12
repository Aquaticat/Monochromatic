# Planning: make `no-nullish-union`'s diagnostic a ranked decision tree

Status:
 ready to implement.
Refined 2026-06-11 from a reviewed draft;
 every factual claim below was verified against source on that date.

## Context

The custom oxlint rule `no-nullish-union` bans union types containing `null` or `undefined` in
`packages/oxlint-plugins/no-restricted-syntax/src/rules/no-nullish-union.ts`.

Its current diagnostic is one long flat paragraph.
That makes the accepted fixes read as co-equal even though they are not.
The message should guide the reader toward the cheapest correct fix first and the heaviest fix last.

The new message encodes the ideal ordering for this repo:

1.   Optional object property or field.
2.   Local guard and early return.
3.   Loud boundary failure through `nonNullishOrThrow`.
4.   A traveling absence value: a domain-specific `unique symbol` sentinel,
     or a distinct non-empty domain value.
5.   A scoped disable only for genuine external API mirrors.

This change is more than a one-string edit because the diagnostic prescribes code.
Every recommended pattern must conform to the repo's other lint rules and documented conventions.

## Verified ground truth

Facts checked against source so the implementer does not re-derive them.

- Tests assert only diagnostic code and count.
  `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`
  checks `toContain('no-restricted-syntax(no-nullish-union)')` for the invalid fixture,
  a count of exactly 10 nullish-union diagnostics in the forms test,
  and zero diagnostics for the valid fixture.
  Nothing asserts literal message text, so no test change is expected.
- The valid fixture
  `packages/test-fixture/oxlint-no-restricted-syntax/src/valid/no-nullish-union.ts`
  already uses `Symbol('requested key not found in store',)` and passes the fixture config
  with all rules enabled, including `no-low-information-symbol-description`.
  Keep it; it is the canonical local shape example.
- `Symbol('not-found')` is an explicit Bad example in
  `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-low-information-symbol-description/index.ts`.
  That same description appears as a **Good** example in three places that must change:
  the `no-nullish-union.ts` TSDoc, the `no-optional-escape.ts` TSDoc,
  and the README's `## no-nullish-union` code block (there spelled `Symbol('not-found',)` with a trailing comma).
- The repo's `eslint/max-lines` config (`packages/config/oxlint/src/rules/style.ts`) sets
  `skipBlankLines: true, skipComments: true` with a 300 max.
  `no-nullish-union.ts` is 118 raw lines, mostly TSDoc, so this change carries no max-lines risk
  and needs no `constants.ts` split.
- The sibling `no-optional-escape` rule's `ALLOWED` constant and README section already list the
  fixes in the same order this tree ranks them: `foo?: T`, `if`-guard, `nonNullishOrThrow`, sentinel.
  Both also offer "a distinct non-empty domain value" as a sentinel alternative;
  the tree keeps that option (see constraints below).
- The package's `mise.toml` defines `lint`, `lint:oxlint`, `lint:types`, and `test:unit`.
- Embedding the literal disable-directive text inside the message string is safe;
  the ban-disable rules scan comments, not string literals,
  and `no-optional-escape`'s `ALLOWED` constant already embeds the same text.

## Non-negotiable constraints

### Sentinels are world-unique per semantic absence condition

Do not recommend reusing another package's sentinel for a different absence condition.

That is the point of `Symbol`: identity, not description text, makes it unique.
A sentinel should be a fresh, semantically local `unique symbol` for one exact absence condition.
Reuse is correct only when consuming the same API that produced that exact sentinel and comparing
against the sentinel that API documents or exports.

Required wording principle:

```text
Mint a domain-specific `unique symbol` sentinel for this exact absence condition.
```

Forbidden wording:

```text
prefer reusing an existing sentinel
```

A symbol description is debugging text, not identity.
Export the sentinel only when consumers must compare against values returned by that API.

### Keep the domain-value sentinel option

The current message, the rule TSDoc, `no-optional-escape`'s `ALLOWED` constant,
and the README all offer "a unique `Symbol`, or a distinct non-empty domain value".
`no-optional-escape` explicitly allows non-empty literal members such as `T | "pending"`.

Dropping the domain-value option from the new tree would create exactly the cross-rule drift
this plan elsewhere forbids.
Branch (4) therefore names both: the `unique symbol` sentinel as the primary form,
and a distinct non-empty domain value as the lighter alternative when the domain has one.

### Symbol examples must pass the sibling rule

The sibling `no-low-information-symbol-description` rule rejects vague descriptions such as
`Symbol('not-found')` and descriptions with fewer than 3 distinct words.
Its own messages require descriptions immediately understandable outside the repo.

Use examples like:

```ts
const KEY_NOT_FOUND: unique symbol = Symbol('requested key not found in store');
const CONFIG_FILE_MISSING: unique symbol = Symbol('config file missing on disk');
```

Never recommend:

```ts
Symbol('absent');
Symbol('not-found');
Symbol('missing');
```

The one place `Symbol('not-found')` must stay is the Bad example inside
`no-low-information-symbol-description/index.ts`; it is deliberately non-compliant.

### Optional-property wording must not include parameters

Do not say `optional property/field/param -> foo?: T`.

`exactOptionalPropertyTypes` is specifically about optional object properties.
Optional parameters have different TypeScript semantics.
Parameter cases should be handled by a guard, a default value, throwing at a boundary,
overloads, or a scoped external-boundary mirror.

Use:

```text
optional object property/field -> `foo?: T`
```

### Symbol union narrowing must follow TY4

When the diagnostic mentions how consumers narrow a symbol sentinel,
say to narrow by `typeof` first and then identity check.

```ts
if ((typeof value) === 'symbol') {
  if (value === KEY_NOT_FOUND) {
    // missing-key branch
  }
}
```

The exact example in the lint message can be shorter,
but the wording must preserve the order: `typeof` first, then `===`.

### Keep the `no-optional-escape` never-list consistent

The `no-nullish-union` diagnostic must mirror the sibling `no-optional-escape` canonical never-list,
word for word:

```text
null, undefined, empty string, zero, negative one, false, void, empty tuple, empty object, Partial
```

Do not call it the "same" list and then add items inside the diagnostic.

The README or TSDoc may separately note that empty arrays, `Option`, `Maybe`,
and `Result` wrappers are also not this repo's accepted absence model.
If that extra guidance ever moves into a shared diagnostic list,
update `no-optional-escape` in the same change instead of letting the two rules drift.

### External-boundary mirrors stay possible but explicit

The rule must remain disableable for genuine external API mirrors.
The diagnostic requires a scoped disable with a justification naming the external API
and why the mirror is unavoidable.

## Proposed diagnostic message

Extract the message to a named constant above the rule object, `NO_NULLISH_UNION_MESSAGE`,
authored as an array of lines joined with `\n`.
The rendered text:

```text
Union type contains `null` or `undefined`. This repo models absence without nullish unions.
exactOptionalPropertyTypes is on: for optional object properties, `?:` already means absent-or-`T`.
Pivoting to `null`, or sliding to `| void`, tuple-as-Maybe, falsy literals, an empty object, or
`Partial<T>`, is still fake optionality (the sibling no-optional-escape rule owns those forms).
Take the first branch that fits:
(1) optional object property/field -> `foo?: T` (never `foo?: T | undefined`, never `foo: T | undefined`).
(2) value may be absent but presence is establishable here -> `if`-guard / early return so the
typed slot receives only `T`.
(3) absence should fail loud at this boundary -> throw via `nonNullishOrThrow` from
`@monochromatic-dev/module-or-throw`.
(4) absence must travel onward as a real value -> mint a domain-specific `unique symbol` sentinel
for this exact absence condition, e.g.
`const KEY_NOT_FOUND: unique symbol = Symbol('requested key not found in store')`,
or carry a distinct non-empty domain value; consumers narrow symbols with
`typeof value === 'symbol'` first, then identity (`value === KEY_NOT_FOUND`).
Heaviest ordinary fix, reach for it last.
(5) genuinely mirroring an external API typed `T | null`/`T | undefined` -> scoped
`oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- <reason naming the external
API and why the mirror is unavoidable>`.
Never use `null`, `undefined`, an empty string, `0`, `-1`, `false`, `void`, an empty tuple,
an empty object, or `Partial` as a stand-in for absent.
```

Exact line breaks within a branch are an authoring choice;
what must survive verbatim are the branch markers `(1)` through `(5)`, the branch order,
the required and forbidden wordings from the constraints above, and the closing never-list.

The diagnostic intentionally ranks fixes by cost and conceptual weight:

1.   `?:` is cheapest when the slot is an optional object property or field.
2.   An `if` guard keeps the value's type pure with no new vocabulary.
3.   `nonNullishOrThrow` is a one-line loud boundary failure.
4.   A `unique symbol` sentinel creates a new value and a consumer-side narrowing protocol,
     so it is the heaviest ordinary fix; a non-empty domain value is its lighter sibling
     when the domain offers one.
5.   A scoped disable is reserved for external types that must be mirrored exactly.

## Files to change

### Primary rule file

Path:

```text
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-nullish-union.ts
```

Changes:

- Add `NO_NULLISH_UNION_MESSAGE` above the exported rule object.
- Give the constant TSDoc explaining that the message is a ranked decision tree and that the
  sentinel branch must satisfy the sibling symbol-description rule.
- Change `meta.messages.forbidden` to reference `NO_NULLISH_UNION_MESSAGE`.
- Update `meta.docs.description` too;
  it currently says "use `foo?: T`, an if-guard, or a genuine `Symbol` sentinel",
  which omits `nonNullishOrThrow` and the disable branch.
  Summarize the five branches in order.
- Update the rule-level TSDoc so it mirrors the decision tree.
- Replace the stale "`void` (`TSVoidKeyword`) is out of scope" framing with:

```text
This rule only matches `TSUndefinedKeyword` and `TSNullKeyword` inside `TSUnionType`;
the sibling `no-optional-escape` rule owns `| void`, tuple encodings, `Partial<T>`,
and other type-level fake-optionality escapes.
```

- Fix the TSDoc Good example `const NOT_FOUND = Symbol('not-found');` to use a compliant
  3+ distinct-word description.
- Keep the detail that a standalone `type X = undefined` or `type X = null` is not a union
  and is not flagged.

### Sibling rule TSDoc

Path:

```text
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-optional-escape.ts
```

Its TSDoc Good example also uses `const NOT_FOUND = Symbol('not-found');`,
violating the same examples-must-pass-the-sibling-rule principle.
Replace the description with a compliant one (one-line fix; nothing else changes in this file).

### Shared oxlint config comment

Path:

```text
packages/config/oxlint/src/rules/restriction.ts
```

Change the comment above `no-restricted-syntax/no-nullish-union` so it summarizes the ranked tree:

- Optional object property or field: `foo?: T`.
- Local presence check: guard and early return.
- Boundary failure: `nonNullishOrThrow`.
- Traveling absence value: mint a domain-specific `unique symbol` sentinel for this exact absence
  condition, or carry a distinct non-empty domain value.
- External mirror: scoped disable with justification.

Do not mention reusing sentinels.
The adjacent `no-optional-escape` comment's "Same fixes apply" phrasing still holds and stays.

### README

Path:

```text
packages/oxlint-plugins/no-restricted-syntax/README.md
```

Two places, not one:

- The rules-summary bullet for `no-nullish-union` near the top
  ("use `?:`, an if-guard, or a genuine `Symbol` sentinel")
  must name all five branches in ranked order, compactly.
- The `## no-nullish-union` section:
  - Replace the flat "Proper fixes" list with the ranked decision tree.
  - Remove the stale "`void` (`TSVoidKeyword`) is out of scope" framing.
    Say this rule owns only `null` and `undefined` union members,
    while `no-optional-escape` owns `| void`, tuple encodings, `Partial<T>`,
    and related type-level escapes.
  - Fix the code-block example `Symbol('not-found',)` (note the trailing comma)
    to a compliant 3+ distinct-word description.
  - Say sentinels are local to a semantic absence condition and should not be reused across
    unrelated conditions.
  - Optionally add a prose note, outside the canonical diagnostic never-list,
    that empty arrays and Option/Maybe/Result wrappers are not accepted absence modeling
    in this repo.

## No planned test or fixture changes

Verified (see ground truth): tests assert only diagnostic code and count for `no-nullish-union`,
so no test change is expected.
If implementation reveals an assertion on literal message text after all,
update that assertion to the new message.

The valid fixture already uses a compliant Symbol description;
do not replace it with a reused sentinel.

## Implementation notes

- Author the message as an array of lines joined with `\n` for readability.
- Before finalizing, verify how oxlint renders newlines in plugin diagnostics.
  The unit-test harness uses `--format json`,
  so the rendering check needs a plain `oxlint -c .oxlintrc.fixture.json <fixture>` run
  against the invalid fixture.
  - If oxlint preserves line breaks, keep `join('\n')`.
  - If oxlint collapses line breaks to spaces,
    the `(1)` through `(5)` markers still keep the message readable.
  - If oxlint removes line breaks without adding spaces, change the join to `' '`.
- Do not use `dedent`;
  the repo's `dedent` guidance is for thrown runtime error messages, not lint `meta.messages`.
- Keep code tokens backtick-wrapped, consistent with existing diagnostics.
- Do not compress code or comments to satisfy max-lines.
  Verified moot here (`skipComments: true`, file far under budget),
  but if the file somehow approaches the limit,
  move constants to a sibling `constants.ts` rather than raising or bypassing the limit.

## Verification checklist

Run the package checks (task names verified against the package `mise.toml`):

```sh
mise run //packages/oxlint-plugins/no-restricted-syntax:lint:types
mise run //packages/oxlint-plugins/no-restricted-syntax:test:unit
mise run //packages/oxlint-plugins/no-restricted-syntax:lint
```

User-boundary verification:

1.   Lint the invalid `no-nullish-union` fixture with plain (non-JSON) output.
2.   Read the rendered diagnostic text.
3.   Confirm the decision tree is legible and the branch markers survive rendering.
4.   Confirm the message does not recommend reused sentinels.

Search checks before final response.
The draft's fixed strings were wrong in two ways:
`"void is out of scope"` matches nothing because the real text reads
`` `void` (`TSVoidKeyword`) is out of scope ``
(backticks and the parenthetical break the fixed string),
and `"Symbol('not-found')"` misses the README's trailing-comma spelling
while over-matching the symbol rule's deliberate Bad example.
Corrected commands:

```sh
rg --fixed-strings "is out of scope" packages/oxlint-plugins/no-restricted-syntax packages/config/oxlint
rg --fixed-strings "Symbol('not-found" packages/oxlint-plugins/no-restricted-syntax packages/config/oxlint
rg --fixed-strings "prefer reusing an existing sentinel" packages/oxlint-plugins/no-restricted-syntax packages/config/oxlint
rg --fixed-strings "optional property/field/param" packages/oxlint-plugins/no-restricted-syntax packages/config/oxlint
```

Expected results:

- Search 1, 3, and 4: zero matches.
- Search 2: exactly one match,
  the deliberate Bad example in
  `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-low-information-symbol-description/index.ts`.
  Any other match (rule TSDoc, sibling TSDoc, README) is an incomplete edit.

## Completion criteria

The change is complete only when all of the following are true:

- The diagnostic is a ranked decision tree, not a flat menu.
- The optional branch mentions only object properties or fields, not parameters.
- The sentinel branch says to mint a domain-specific `unique symbol` for the exact absence
  condition, and keeps the distinct non-empty domain value alternative.
- The sentinel branch does not recommend reusing another package's sentinel.
- Every Good Symbol example in edited surfaces uses a compliant 3+ distinct-word description,
  including the `no-optional-escape.ts` TSDoc.
- The consumer narrowing wording says `typeof` first, then identity check.
- No edited surface still frames `void` as merely "out of scope" without naming
  `no-optional-escape` as its owner.
- The rule TSDoc, `meta.docs.description`, config comment, README summary bullet,
  and README section all agree on the same five-branch guidance.
- Tests, type-checking, linting, and rendered-diagnostic verification pass.
- The four search checks return their expected results exactly.
