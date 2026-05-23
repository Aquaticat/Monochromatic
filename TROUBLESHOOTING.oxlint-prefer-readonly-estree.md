# oxlint 1.65 `typescript/prefer-readonly-parameter-types` does not match `allow` specifiers for `@oxlint/plugins` 1.58 ESTree namespace types (`ESTree.Node`, `ESTree.Function`) because their bundled symbol names carry a `$1` suffix

oxlint's type-aware `prefer-readonly-parameter-types` rule (run through tsgolint) keeps
flagging parameters typed `ESTree.Node` and `ESTree.Function` even though the shared
allow-list already lists `Node` and `Function` under `package: '@oxlint/plugins'`. The
allow entry never matches, so the rule recurses into the union and reports the parameter.

## Symptom

Writing a `@monochromatic-dev/config-oxlint-no-restricted-syntax` rule with an AST visitor
parameter typed through the re-exported ESTree namespace:

```typescript
import type { ESTree, } from '@oxlint/plugins';

function isRegExpLiteral(node: ESTree.Node,): node is ESTree.RegExpLiteral { /* ... */ }
function checkFunction(node: ESTree.Function,): void { /* ... */ }
```

produces, under `task-oxlint --type-aware`:

```text
! typescript(prefer-readonly-parameter-types): Parameter should be a readonly type.
  ,-[src/rules/no-regex.ts:39:26]
39 | function isRegExpLiteral(node: ESTree.Node,): node is ESTree.RegExpLiteral {
   :                          ^^^^^^^^^^^^^^^^^
```

The allow-list at
`packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts` already
contains the entry that should silence this:

```typescript
{
  from: "package",
  package: "@oxlint/plugins",
  name: [ /* ... */ "Node", /* ... */ "Span", /* ... */ ],
}
```

The trap: only `ESTree.Node`, `ESTree.Function`, and `ESTree.PropertyKey` are affected.
Sibling types reached the same way (`ESTree.Program`, `ESTree.Statement`,
`ESTree.CallExpression`, and the rest) are silenced correctly by their plain names. Nothing
in the symptom hints that three names out of the namespace behave differently.

## Root cause

`ESTree.Node` does not resolve to a type whose symbol is named `Node`. It resolves to a
union type alias whose symbol is named `Node$1`, and the allow specifier matches on symbol
name.

Walk the chain.

1.  `ESTree` is the `types_d_exports` namespace, re-exported under an alias.
    `node_modules/@oxlint/plugins/index.d.ts:4021`:

    ```typescript
    export { /* ... */ type types_d_exports as ESTree, /* ... */ type Node, /* ... */ };
    ```

    Note `type Node` is also a top-level export, distinct from the namespace member.

2.  Inside the namespace, `Node` is a renamed re-export of `Node$1`.
    `index.d.ts:1135`:

    ```typescript
    declare namespace types_d_exports {
      export { /* ... */ Function$1 as Function, /* ... */ Node$1 as Node, /* ... */ PropertyKey$1 as PropertyKey, /* ... */ };
    }
    ```

    The package declares two AST shapes in one module: an oxc-style visitor AST (top-level
    `interface Node extends Span {}` at `index.d.ts:2777`) and the estree-format AST. The
    three estree names that collide with an oxc-style declaration are renamed with a `$1`
    suffix: `type Node$1` (`index.d.ts:2428`), `interface Function$1 extends Span`
    (`index.d.ts:1612`), `type PropertyKey$1` (`index.d.ts:1206`). So `ESTree.Node` is
    `Node$1`, `ESTree.Function` is `Function$1`, `ESTree.PropertyKey` is `PropertyKey$1`.
    Sibling names that do not collide (`Program`, `Statement`, `CallExpression`) keep their
    plain name, which is why their allow-list entries already work.

3.  `Node$1` is a large union type alias. `index.d.ts:2428`:

    ```typescript
    type Node$1 = Program | IdentifierName | IdentifierReference | BindingIdentifier
      /* ... ~200 members ... */ | ParamPattern;
    ```

4.  tsgolint matches an `allow` specifier by the type's alias or symbol name.
    `internal/utils/type_matches_specifier.go:146`:

    ```go
    func typeMatchesStringSpecifier(t *checker.Type, names []string) bool {
        alias := checker.Type_alias(t)
        var symbol *ast.Symbol
        if alias == nil {
            symbol = checker.Type_symbol(t)
        } else {
            symbol = alias.Symbol()
        }
        if symbol != nil && slices.Contains(names, symbol.Name) {
            return true
        }
        // ...
        return false
    }
    ```

    For `ESTree.Node` the alias symbol name is `Node$1`, not `Node`, so
    `slices.Contains(["Node", ...], "Node$1")` is false. The package/source check that
    follows never runs, because the name gate already failed.

5.  Because the whole-type match failed and `Node$1` is a union, the rule recurses into each
    union member. `internal/rules/prefer_readonly_parameter_types/prefer_readonly_parameter_types.go:211`:

    ```go
    if utils.TypeMatchesSomeSpecifier(t, opts.allow, program) {
        return readonlynessReadonly
    }
    if utils.IsUnionType(t) {
        for _, subType := range t.Types() {
            // ...
            if isTypeReadonlyRecurser(program, typeChecker, subType, opts, seenTypes) != readonlynessReadonly {
                return readonlynessMutable
            }
        }
        return readonlynessReadonly
    }
    ```

    Members such as `IdentifierName` are mutable interfaces and are not in the allow-list, so
    the first such member returns `readonlynessMutable` and the parameter is reported.

An earlier reading of this bug blamed the empty interface `interface Node extends Span {}`
(`index.d.ts:2777`) and guessed the type collapsed to its `Span` base. That was wrong: the
probe in the Verification section shows name-only `"Span"` does not silence the parameter
either, and `index.d.ts:1135` shows `ESTree.Node` is the renamed union `Node$1`, not that
empty interface. The empty `interface Node` at 2777 is the top-level `type Node` export, a
different symbol from `ESTree.Node`.

## Verification

Versions under test:

- `@oxlint/plugins` 1.58.0 (`pnpm-lock.yaml:3718`).
- `oxlint` 1.65.0 (`node_modules/.bin/oxlint --version`), which drives tsgolint for
  `--type-aware`.
- tsgolint source read at commit `78f9a83` (2026-05-22), cloned to `/tmp/tsgolint`.

Harness. A throwaway directory with the real `@oxlint/plugins` copied into its
`node_modules` (copied, not symlinked, so `IsSourceFileFromExternalLibrary` and package-name
resolution behave as in a normal install):

```bash
REPRO=$(mktemp -d)
mkdir -p "$REPRO/node_modules/@oxlint"
cp -r node_modules/.pnpm/@oxlint+plugins@1.58.0/node_modules/@oxlint/plugins \
  "$REPRO/node_modules/@oxlint/plugins"
```

`$REPRO/test.ts`:

```typescript
import type { ESTree, } from '@oxlint/plugins';

export function fNode(node: ESTree.Node,): void { void node; }          // Node$1 (union)
export function fProgram(node: ESTree.Program,): void { void node; }     // Program (interface)
export function fStatement(node: ESTree.Statement,): void { void node; } // Statement (union)
interface LocalMutable { x: number; }
export function fLocal(arg: LocalMutable,): void { void arg; }           // local control
```

`$REPRO/tsconfig.json` enables `strict` with `moduleResolution: "bundler"` and
`include: ["test.ts"]`. Run each config with:

```bash
node_modules/.bin/oxlint --type-aware -c "$CONFIG.json" test.ts
```

Specifiers that work (parameter silenced):

- `["Node$1", "Function$1"]` (name-only) silences `fNode` and `fFunction`.
- `[{ "from": "package", "package": "@oxlint/plugins", "name": ["Node$1", "Function$1"] }]`
  silences `fNode` and `fFunction`.
- `["Program"]`, `["Statement"]` silence `fProgram`, `fStatement` (non-renamed siblings).
- `["LocalMutable"]` and `[{ "from": "file", "name": ["LocalMutable"] }]` silence `fLocal`
  (confirms the harness and name matching work in the normal case).

Specifiers that do not work (parameter still reported):

- `["Node", "Function"]` (name-only): `fNode`, `fFunction` still flagged.
- `[{ "from": "package", "package": "@oxlint/plugins", "name": ["Node", "Function"] }]`:
  still flagged. This is the exact shape the repo allow-list uses today.
- `[{ "from": "file", "name": ["Node", "Function"] }]`: still flagged (isolates the failure
  to the name gate, since the file gate would pass for a node_modules path under cwd).
- `["Span"]`: still flagged (disproves the empty-interface-collapses-to-base hypothesis).

## Verified workarounds

Add the `$1`-suffixed symbol names to the existing `@oxlint/plugins` package specifier in
`prefer-readonly-parameter-types.allow-pkg.ts`, keeping the plain names alongside them:

```typescript
{
  from: "package",
  package: "@oxlint/plugins",
  name: [
    // ... existing names ...
    "Node", "Node$1",
    "Function", "Function$1",
    "PropertyKey", "PropertyKey$1",
  ],
}
```

Tradeoffs:

- The `$1` suffix is a bundler disambiguation artifact, not a stable public name. If a future
  `@oxlint/plugins` release changes its bundling (drops the duplicate top-level emission, or
  the suffix becomes `$2`), these entries stop matching. The failure is loud, not silent: the
  affected parameters get flagged again at lint time, so a version bump that changes the
  suffix surfaces immediately. Keeping the plain `Node`/`Function` names alongside means the
  allow-list self-heals if a future version stops renaming.
- Only the union top-level match is needed; because the rule short-circuits on a whole-type
  match before recursing (`prefer_readonly_parameter_types.go:211`), allow-listing `Node$1`
  exempts the entire union without enumerating its ~200 members.
- The package specifier is preferred over a bare name-only `"Node$1"` string: name-only would
  exempt any repo type that happens to be named `Node$1`, while the package form also checks
  the declaration resolves to `@oxlint/plugins`.

This is a consumer-side allow-list correction. It does not touch `@oxlint/plugins` or
tsgolint and survives regardless of upstream movement.

The throwaway repro verified the `["Node$1", "Function$1"]` shape exempts the affected
parameters. The literal repo entry above (plain and `$1` names together) has not been run
against the real `allow-pkg.ts` yet. When applying it, run
`mise run //packages/config/oxlint-no-restricted-syntax:lint:oxlint` and confirm the bare
`ESTree.Node` (3 sites) and `ESTree.Function` (1 site) reports drop from the package's
current 20-warning total. The `ESTree.PropertyKey` entry is included for completeness; no
repo parameter uses it today.

## What does not work

- Plain names `"Node"`/`"Function"` in any specifier shape (name-only, `package`, `file`):
  the name gate compares against `Node$1`/`Function$1` and fails.
- Allow-listing the base `"Span"`: `ESTree.Node` is the union `Node$1`, not the empty
  `interface Node extends Span {}`; the base name is never consulted.
- Enumerating union member names (`"Program"`, `"IdentifierName"`, ...): would in principle
  let the union recursion pass, but the union has roughly 200 members and the list would have
  to track every estree node addition. Allow-listing the union alias `Node$1` is one entry.
- Editing the rule severity or `treatMethodsAsReadonly`: orthogonal; does not address the
  name mismatch.

## Draft upstream issue

Do not file as-is. The 5-constraint audit below concludes do-not-file; the draft is kept so a
future session can re-evaluate if upstream signal changes.

### Why we do not file this upstream

1.  Is it really upstream's fault? Not cleanly. Two candidate upstreams. `@oxlint/plugins`
    emits the ESTree AST types twice and the bundler suffixes the colliding namespace copies
    with `$1`; that is valid, normal `.d.ts` bundler output, not a defect. tsgolint matches
    `allow` by the resolved symbol/alias name (`Node$1`), which is identical to
    typescript-eslint's own matcher. typescript-eslint
    `packages/type-utils/src/typeOrValueSpecifiers/specifierNameMatches.ts:11` (read at the
    repo HEAD on 2026-05-23):

    ```typescript
    const symbol = type.aliasSymbol ?? type.getSymbol();
    const candidateNames = symbol
      ? [symbol.escapedName as string, type.intrinsicName]
      : [type.intrinsicName];
    ```

    `symbol.escapedName` for `ESTree.Node` is `Node$1`, so the JavaScript typescript-eslint
    rule would reject `name: ["Node"]` exactly as tsgolint does. Neither side is doing
    something wrong; the failure is an interaction between dts bundling and the shared
    symbol-name matching design.
2.  Can upstream fix it? Only with disproportionate change. `@oxlint/plugins` would have to
    restructure its type emission to avoid the duplicate namespace/top-level copies.
    tsgolint would have to match on the name as referenced at the use site rather than the
    declaration symbol name, a semantics change touching every `allow` user across all rules.
3.  Are they supporting this use case? No documentation, example, or test on either side
    covers allow-listing a `$1`-renamed re-exported namespace member. The `allow` option is
    documented for ordinary named types.
4.  Will they likely fix it? Unlikely. tsgolint's matcher mirrors typescript-eslint by
    design; changing it risks the broader `allow` contract. No commits in the matcher path
    (`type_matches_specifier.go` at `78f9a83`) suggest movement toward import-site matching.
5.  Have we prototyped a minimal upstream fix? Not applicable. The correct fix is
    consumer-side (the allow-list entry above), which fully resolves the user-facing problem
    without an upstream change. Constraints 1 and 4 do not hold, so the auto-prototype path
    is not triggered.

Kept draft, in case upstream signal changes:

~~~md
Title: `prefer-readonly-parameter-types` `allow` cannot target re-exported namespace
types whose bundled symbol carries a `$1` suffix

Labels: bug, rule, type-aware

When a package re-exports a type under a namespace with a rename
(`export { Node$1 as Node }` in a bundled `.d.ts`), the resolved type's symbol name is the
declaration name (`Node$1`), not the exported name (`Node`). An `allow` specifier written
against the name the source code uses (`{ package: "pkg", name: ["Node"] }`) never matches,
and for a union alias the rule then recurses into members and reports the parameter.

Reproduction: `@oxlint/plugins` 1.58.0 exposes `ESTree.Node` as `Node$1`. With
`allow: [{ from: "package", package: "@oxlint/plugins", name: ["Node"] }]`, a parameter
typed `node: ESTree.Node` is still reported. Switching the name to `"Node$1"` silences it.
See `index.d.ts:1135` (`Node$1 as Node`) and `type_matches_specifier.go:146`
(`typeMatchesStringSpecifier` matching `symbol.Name`).

Suggested change (a contract change, not a bug fix): match an `allow` name against the
export-alias name at the reference site in addition to the declaration symbol name. Both
tsgolint and typescript-eslint match `symbol.escapedName` by design, so this would alter the
`allow` contract for every consumer and rule, not just this case. Code locations:
`internal/utils/type_matches_specifier.go` (`typeMatchesStringSpecifier`,
`typeMatchesSpecifier`); typescript-eslint
`packages/type-utils/src/typeOrValueSpecifiers/specifierNameMatches.ts`.
~~~
