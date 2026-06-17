# detekt-rules

Custom [detekt] rule set for the music-player Android app. Provides one rule,
`RequireKDoc`, that enforces KDoc on every Kotlin declaration, the Kotlin
counterpart of the repo's `require-tsdoc` oxlint rule for TypeScript.

## Why this exists

detekt ships `UndocumentedPublicClass`, `UndocumentedPublicFunction`, and
`UndocumentedPublicProperty`, but they only cover the public API surface and cannot
be configured down to private or local declarations. The repo's documentation
standard is "everywhere", so a custom rule is required.

## The rule contract

`RequireKDoc` reports any declaration of a covered kind that has no preceding KDoc
(`KtDeclaration.docComment == null`).

Covered kinds:

- classes, interfaces, annotation classes (`KtClass`)
- objects and companion objects (`KtObjectDeclaration`)
- named functions, including member and local ones (`KtNamedFunction`)
- properties, including member and local `val`/`var` (`KtProperty`)
- secondary constructors (`KtSecondaryConstructor`)
- type aliases (`KtTypeAlias`)
- enum entries (`KtEnumEntry`)

Deliberately skipped, mirroring `require-tsdoc`:

- parameters (documented via the owner's `@param`)
- primary constructors (documented by the class KDoc)
- property accessors (documented by the property)
- anonymous object literals, destructuring entries, and `init` blocks

The implementation overrides a single choke point, `visitDeclaration`, because every
declaration kind delegates to it in the PSI visitor chain. The `super` call preserves
the tree walk into bodies, which is what reaches local and nested declarations.

## Configuration

```yaml
# detekt.yml (at the android-app root)
require-kdoc:
  RequireKDoc:
    active: true
    # Skip test sources, as require-tsdoc skips .test.ts.
    excludes: ['**/test/**', '**/androidTest/**']
    # Set true to let `override` members inherit documentation. Default false.
    allowOverride: false
```

## Running

The rule is consumed by `:app` through `detektPlugins(project(":detekt-rules"))` and
runs as part of detekt:

```sh
mise run //packages/music-player/android-app:lint:detekt   # detekt over the app
mise run //packages/music-player/android-app:test:detekt-rules   # this module's tests
```

## Adding a rule

Add the rule class beside `RequireKDoc.kt`, then register it in the `instance`
list inside `KdocRuleSetProvider.kt`. The service file at
`src/main/resources/META-INF/services/io.gitlab.arturbosch.detekt.api.RuleSetProvider`
only needs the provider, not individual rules.

[detekt]: https://detekt.dev
