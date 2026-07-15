# kotlin-linter

Monorepo-wide [detekt][] rule set enforcing KDoc on every Kotlin declaration,
the Kotlin counterpart of the repo's `require-tsdoc` oxlint rule for TypeScript.
It is the Kotlin sibling of `package/linter/rust`:
a standalone linter run over all of `package/` by the root `lint:detekt` task.

## Why this exists

detekt ships `UndocumentedPublicClass`,
`UndocumentedPublicFunction`,
and `UndocumentedPublicProperty`,
but they only cover the public API surface and cannot be configured down to private or local declarations.
The repo's documentation standard is "everywhere",
so a custom rule is required.

## The rule contract

`RequireKDoc` reports any declaration of a covered kind that has no preceding KDoc
(`KtDeclaration.docComment == null`).

Covered kinds:

- classes,
  interfaces,
  annotation classes (`KtClass`)
- objects and companion objects (`KtObjectDeclaration`)
- named functions,
  including member and local ones (`KtNamedFunction`)
- properties,
  including member and local `val`/`var` (`KtProperty`)
- secondary constructors (`KtSecondaryConstructor`)
- type aliases (`KtTypeAlias`)
- enum entries (`KtEnumEntry`)

Deliberately skipped,
mirroring `require-tsdoc`:

- parameters (documented via the owner's `@param`)
- primary constructors (documented by the class KDoc)
- property accessors (documented by the property)
- anonymous object literals,
  destructuring entries,
  and `init` blocks

The implementation overrides a single choke point,
`visitDeclaration`,
because every declaration kind delegates to it in the PSI visitor chain.
The `super` call preserves the tree walk into bodies,
which is what reaches local and nested declarations.

## How it runs monorepo-wide

The root `lint:detekt` task (in `mise.no-env.toml`,
part of the `lint` aggregate) invokes the detekt CLI over `package/`
with this module's jar on `--plugins`.
Detekt's default config stays active,
and this package adds `require-kdoc` on top:

```sh
mise run lint:detekt    # scan all of package/
```

Global excludes drop build output,
`.gradle` caches,
build scripts (`.kts`),
and test sources (`**/src/test/**`,
`**/src/androidTest/**`) before parsing.

## Configuration

`detekt.yml` activates `require-kdoc` and leaves findings at detekt 2's default `error` severity,
so missing KDoc fails the run.
See the [default-config troubleshooting note](../../../doc/troubleshooting/detekt-default-config.md)
for the source trace.
The `allowOverride` rule option (default false) can let `override` members inherit documentation.

## Package tasks

```sh
mise run //package/linter/kotlin:test                  # rule unit tests
mise run //package/linter/kotlin:lint                  # local compile check
mise run //package/linter/kotlin:lint:detekt  # dogfood own src
mise run //package/linter/kotlin:build        # build plugin jar
```

## Adding a rule

Add the rule class beside `RequireKDoc.kt`,
then register its factory in the map inside `KdocRuleSetProvider.kt`.
The `dev.detekt.api.RuleSetProvider` service file under `src/main/resources/META-INF/services/`
only needs the provider,
not individual rules.

[detekt]: https://detekt.dev
