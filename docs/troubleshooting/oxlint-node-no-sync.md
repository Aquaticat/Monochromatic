# Oxlint 1.71.0 `node/no-sync` flags non-Node `parseSync` calls by suffix alone

## Symptom

`mise run //packages/cli/git:lint:oxlint` reports `node(no-sync)` warnings for Optique CLI parser calls:

```text
! node(no-sync): Unexpected sync method: 'parseSync'.
  ,- [src/parsers/push.ts:67:23]
66 |        */
67 | ,->   const parseResult = parseSync(
68 | |       pushRegionParser,
69 | |       postSubcommandArgs,
70 | `->   );
```

The same diagnostic appears at these package paths:

- `packages/cli/git/src/parsers/stash.ts:121`
- `packages/cli/git/src/parsers/add.ts:289`
- `packages/cli/git/src/parsers/reset.ts:149`
- `packages/cli/git/src/parsers/clean.ts:161`
- `packages/cli/git/src/parsers/commit.ts:244`
- `packages/cli/git/src/parsers/push.ts:67`
- `packages/cli/git/src/parsers/status.ts:102`
- `packages/cli/git/src/parsers/status.ts:158`

The import is not a Node builtin API.
`packages/cli/git/src/parsers/push.ts:3` imports it from Optique:

```ts
// packages/cli/git/src/parsers/push.ts:3
import { parseSync, } from '@optique/core/parser';
```

So the warning is a false positive for this repo's intended rule meaning:
ban sync Node APIs,
not every function whose name ends in `Sync`.

## Root cause

Source clone:
`/tmp/agent/oxc-js-plugin-sync-20260629`,
origin `https://github.com/oxc-project/oxc.git`,
commit `da0e5bf6687b4bc5f376898f2d59832c6419ce15`.

Oxlint's `node/no-sync` rule checks every call expression and extracts a sync-looking name from the callee.
`crates/oxc_linter/src/rules/node/no_sync.rs:79-96`:

```rust
// crates/oxc_linter/src/rules/node/no_sync.rs:79-96
fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
    let AstKind::CallExpression(call_expr) = node.kind() else {
        return;
    };

    let Some(property_name) = get_sync_property_name(&call_expr.callee) else {
        return;
    };

    if self.0.ignores.contains(property_name) {
        return;
    }

    if self.0.allow_at_root_level && get_enclosing_function(node, ctx).is_none() {
        return;
    }

    ctx.diagnostic(no_sync_diagnostic(call_expr.span, property_name));
}
```

The extractor is suffix-based.
It does not inspect imports,
resolved modules,
or whether the callee belongs to a Node builtin.
`crates/oxc_linter/src/rules/node/no_sync.rs:100-120`:

```rust
// crates/oxc_linter/src/rules/node/no_sync.rs:100-120
fn get_sync_property_name<'a>(expr: &'a Expression<'a>) -> Option<&'a str> {
    match expr.get_inner_expression() {
        Expression::Identifier(ident) if ident.name.as_str().ends_with("Sync") => {
            Some(ident.name.as_str())
        }
        Expression::StaticMemberExpression(member) => {
            if member.property.name.as_str().ends_with("Sync") {
                Some(member.property.name.as_str())
            } else {
                get_sync_property_name(&member.object)
            }
        }
        Expression::ComputedMemberExpression(member) => {
            if let Some(name) = member.static_property_name()
                && name.as_str().ends_with("Sync")
            {
                return Some(name.as_str());
            }
            get_sync_property_name(&member.object)
        }
        _ => None,
    }
}
```

The only configuration escape hatches are `allowAtRootLevel` and `ignores`.
`crates/oxc_linter/src/rules/node/no_sync.rs:24-28`:

```rust
// crates/oxc_linter/src/rules/node/no_sync.rs:24-28
struct NoSyncConfig {
    /// Whether synchronous methods should be allowed at the top level of a file.
    allow_at_root_level: bool,
    /// Function names to ignore.
    ignores: FxHashSet<CompactStr>,
}
```

That design explains the Optique report:
`parseSync()` is an `Identifier` ending in `Sync`,
so it reports even though it is imported from `@optique/core/parser`.

## Verification

Version under test:
`pnpm-lock.yaml:5340-5341` pins `oxlint@1.71.0`.

Runnable harness:

```bash
mise run //packages/cli/git:lint:oxlint
```

Observed output includes eight `node(no-sync)` warnings for Optique `parseSync` calls,
plus unrelated existing `no-optional-catch-binding` errors in the same package.
One representative warning:

```text
! node(no-sync): Unexpected sync method: 'parseSync'.
  ,- [src/parsers/status.ts:102:23]
101 |        */
102 | ,->   const parseResult = parseSync(
103 | |       statusPreParser,
104 | |       preSubcommandArgs,
105 | `->   );
```

Patterns that fail under upstream `node/no-sync`:

- Direct `Identifier` calls ending in `Sync`,
  such as `parseSync()`,
  regardless of import source.
- Member calls ending in `Sync`,
  such as `fs.readFileSync()`.
- Static computed member calls ending in `Sync`,
  such as `fs['readFileSync']()`.
- Chained calls whose object contains a sync-looking member,
  such as `fs.readFileSync.apply(...)`.

Patterns that work cleanly under upstream `node/no-sync`:

- Non-called references,
  such as `const parser = parseSync`.
- Calls whose final extracted name does not end in `Sync`,
  such as `parse()`.
- Ignored names configured through `ignores`,
  such as `parseSync` when added to the rule config.

## Verified workarounds

### Replace upstream rule with a project-specific rule

Disable `node/no-sync` and enable a custom `no-restricted-syntax/no-sync` rule that only reports sync APIs reached through Node builtin modules.
This is the chosen repo-local workaround.

Tradeoff:
the project owns Node API detection logic.
That is intentional here because the wanted policy is narrower than upstream's suffix rule.

### Configure `ignores`

Add each non-Node sync-looking API name,
such as `parseSync`,
to `node/no-sync`'s `ignores` list.

Tradeoff:
this suppresses every call with that name,
including a future Node or project API with the same identifier.
The ignore list also grows whenever another library exposes a legitimate sync-named API.

### Rename or wrap the library call

Import Optique's mode-dispatching `parse` helper or write a local wrapper whose name does not end in `Sync`.

Tradeoff:
this changes working code only to appease a lint heuristic.
It also hides the more precise policy we want:
ban Node sync APIs,
not arbitrary sync-named functions.

## What does not work

- Keeping `node/no-sync` enabled without `ignores`:
  the rule continues to report any called suffix match.
- Relying on the `node` plugin namespace to imply Node-only resolution:
  the implementation never checks import sources.
- Treating the diagnostic as proof that `parseSync` is a Node API:
  the emitting tool is oxlint's Node plugin,
  but the callee source here is `@optique/core/parser`.

## Upstream filing decision

`.out-of-scope/` was checked with:

```bash
find .out-of-scope -maxdepth 2 -type f -print
```

No oxlint-specific exemption was present.

Duplicate searches returned no matching open or closed issue or PR:

```bash
gh search issues --repo oxc-project/oxc "node/no-sync parseSync" --state open --limit 20
gh search issues --repo oxc-project/oxc "node/no-sync parseSync" --state closed --limit 20
gh search prs --repo oxc-project/oxc "node/no-sync parseSync" --state open --limit 20
gh search prs --repo oxc-project/oxc "node/no-sync parseSync" --state closed --limit 20
gh search issues --repo oxc-project/oxc "no-sync Sync false positive" --state open --limit 20
gh search issues --repo oxc-project/oxc "no-sync Sync false positive" --state closed --limit 20
gh search prs --repo oxc-project/oxc "no-sync Sync false positive" --state open --limit 20
gh search prs --repo oxc-project/oxc "no-sync Sync false positive" --state closed --limit 20
```

Constraint check:

- Is it really upstream's fault?
  Partly.
  The diagnostic is emitted by upstream oxlint and the suffix-only implementation causes this repo's false positive.
  But the implementation appears intentionally suffix-based rather than an accidental import-resolution bug.
- Can upstream fix it?
  Yes.
  A stricter implementation could resolve bindings to Node builtin modules before reporting.
- Are they supporting this use case?
  Not clearly.
  The rule currently supports banning sync-looking calls and offers `ignores`,
  not precise Node builtin API provenance.
- Would the repo welcome our contribution?
  Maybe.
  `CONTRIBUTING.md` welcomes contributions and allows AI assistance with disclosure,
  but requires human review and tested submissions.
- Will they likely fix it?
  Unknown.
  No matching issue or PR was found,
  and no recent `no_sync.rs` path-specific history was present in the shallow source clone.
- Have we prototyped a minimal fix compatible with their architecture?
  No.
  Because the supported-use-case constraint is not met,
  the auto-prototype gate does not fire.

Decision:
do not file upstream as-is.
Keep the project-local rule and revisit upstream only if oxlint documents `node/no-sync` as Node-builtin-provenance-aware or maintainers ask for that behavior.

## Upstream filing artifact

Do not file as-is.

~~~md
Title: linter: node/no-sync reports non-Node parseSync imports by suffix alone

Labels: A-linter

Oxlint version: 1.71.0

Command:

```bash
mise run //packages/cli/git:lint:oxlint
```

Config:

The repo enables the `node` plugin and category-based linting,
which enables `node/no-sync`.

What happened:

`node/no-sync` reports `parseSync()` calls imported from `@optique/core/parser`:

```ts
import { parseSync, } from '@optique/core/parser';

const parseResult = parseSync(parser, args);
```

Expected:

The rule would report sync APIs from Node builtin modules,
such as `node:fs` `readFileSync`,
but would not report unrelated library APIs that merely end in `Sync`.

Source trace:

`crates/oxc_linter/src/rules/node/no_sync.rs:100-120` checks identifiers and member properties with `.ends_with("Sync")`.
It does not inspect import declarations or module provenance before reporting.

Suggested fix:

If the desired semantics are Node-builtin-only,
collect bindings imported or required from Node builtin modules and report sync-looking calls only when the callee resolves to those bindings.
~~~
