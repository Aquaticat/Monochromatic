# detekt 2.0.0-alpha.5 default config opt-in and baseline handling

## Symptom

Removing `--disable-default-rulesets` from the detekt CLI invocation still left
`mise run lint:detekt` green.

The root cause is that default rule-set providers and default rule configuration are separate detekt concepts.
Default providers can load while their rules remain inactive when the run supplies a custom config
and does not also pass `--build-upon-default-config`.

After adding `--build-upon-default-config`,
the Android app surfaced the existing default-rule backlog.
A package-local run before baseline handling reported:

```text
Analysis failed with 95 issues.
```

The counted rules from that package-local run were:

```text
MaxLineLength: 62
FunctionNaming: 12
ReturnCount: 7
TooGenericExceptionCaught: 5
TooManyFunctions: 5
LongMethod: 1
MatchingDeclarationName: 1
NestedBlockDepth: 1
LoopWithTooManyJumpStatements: 1
total: 95
```

The linter package itself also had one default-rule finding:

```text
RequireKDoc.kt:82:18 Function visitDeclaration has 3 return statements which exceeds the limit of 2. [ReturnCount]
```

## Root cause

detekt `2.0.0-alpha.5` declares `--build-upon-default-config` as a separate CLI flag
whose default value is false.

```kotlin
// detekt-cli/src/main/kotlin/dev/detekt/cli/CliArgs.kt:147-150
@Parameter(
    description = "Preconfigures detekt with a bunch of rules and some opinionated defaults for you. " +
        "Allows additional provided configurations to override the defaults."
)
var buildUponDefaultConfig: Boolean = false
```

The CLI spec maps that flag to `useDefaultConfig`.

```kotlin
// detekt-cli/src/main/kotlin/dev/detekt/cli/Spec.kt:50-53
config {
    useDefaultConfig = args.buildUponDefaultConfig
    shouldValidateBeforeAnalysis = null
    configPaths = args.config
```

detekt composes the default config only when `useDefaultConfig` is true,
or when no config was supplied at all.

```kotlin
// detekt-core/src/main/kotlin/dev/detekt/core/tooling/ProcessingSpecSettingsBridge.kt:73-75
if (configSpec.useDefaultConfig || config === Config.empty) {
    declaredConfig = CompositeConfig(declaredConfig, getDefaultConfiguration())
}
```

Rule execution is driven by config keys.

```kotlin
// detekt-core/src/main/kotlin/dev/detekt/core/RuleDescriptor.kt:48-53
): Sequence<RuleDescriptor> =
    config.subConfigKeys()
        .asSequence()
        .mapNotNull { ruleId -> extractRuleName(ruleId)?.let { ruleName -> ruleId to ruleName } }
        .mapNotNull { (ruleId, ruleName) ->
```

`--disable-default-rulesets` only filters providers out.
Without that flag,
providers stay available,
but a custom config that names only `require-kdoc` still leaves default rules without active config entries.

```kotlin
// detekt-core/src/main/kotlin/dev/detekt/core/rules/RuleSets.kt:15-20
return when (val runPolicy = spec.rulesSpec.runPolicy) {
    RulesSpec.RunPolicy.NoRestrictions -> ruleSetProviders

    RulesSpec.RunPolicy.DisableDefaultRuleSets ->
        ruleSetProviders
```

## Verification

Version under test:

- detekt `2.0.0-alpha.5`
- upstream tag `v2.0.0-alpha.5`,
  commit `9c6ced63392cb451b7091dda25a9653875d275b6`
- repo task `packages/linter/kotlin/build.gradle.kts`,
  current runner arguments at lines 76 to 81

The current check task now passes both `--build-upon-default-config` and `--baseline`:

```kotlin
// packages/linter/kotlin/build.gradle.kts:76-81
"--input", inputPath.get(),
"--config", configFile,
"--build-upon-default-config",
"--baseline", baselineFile,
"--plugins", ruleJar.get().asFile.absolutePath,
"--excludes",
```

The baseline refresh task uses the same default config and writes the current findings:

```kotlin
// packages/linter/kotlin/build.gradle.kts:107-112
"--input", inputPath.get(),
"--config", configFile,
"--build-upon-default-config",
"--baseline", baselineFile,
"--create-baseline",
"--plugins", ruleJar.get().asFile.absolutePath,
```

Verified commands after the fix:

```sh
mise run //packages/linter/kotlin:lint:detekt:baseline
mise run lint:detekt
```

Both completed successfully.
The generated baseline currently contains these rule IDs:

```text
MaxLineLength: 61
FunctionNaming: 12
ReturnCount: 8
TooManyFunctions: 5
TooGenericExceptionCaught: 4
LongMethod: 1
LoopWithTooManyJumpStatements: 1
MatchingDeclarationName: 1
NestedBlockDepth: 1
total: 94
```

The baseline count is not expected to match the earlier single-package console count exactly.
Baseline signatures are generated from the combined current main-source inputs,
and `mise run lint:detekt` is the boundary check that proves all package-local findings are covered.

## Verified workarounds

### Pass `--build-upon-default-config`

This is not optional when a custom `detekt.yml` is supplied and default detekt rules must be active.
Removing only `--disable-default-rulesets` loads default providers
but does not seed default rule config.

### Use a current-findings baseline

The detekt documentation says `CurrentIssues` is intended so only new findings are printed on later analysis.

```md
<!-- website/docs/introduction/baseline.md:8-12 -->
With the cli option `--baseline` or the detekt-gradle-plugin closure-property `baseline` you can specify a file which is used to generate a `baseline.xml`.
It is a file where ignored findings are defined.

The intention of `CurrentIssues` is that only new findings are printed on further analysis.
```

The repo uses `packages/linter/kotlin/detekt-baseline.xml` for this purpose.
This handles existing default-rule findings without weakening the rules themselves.

## What does not work

Removing `--disable-default-rulesets` alone does not activate default rule config.
It only changes provider loading.
The verification path that proved this was:

```sh
mise run lint:detekt
```

That command stayed green and printed zero findings until `--build-upon-default-config` was added.

Refreshing the baseline from a broad `packages/` input is also not the chosen path.
The committed `lint:detekt:baseline` task passes the same main-source roots covered by the fanout tasks,
so the baseline does not pick up tests or Gradle scripts.

## Upstream filing decision

No upstream issue should be filed.

- Upstream behavior is intentional:
  the CLI exposes separate flags for provider loading and default config composition.
- The documentation describes the baseline mechanism and its `CurrentIssues` intent.
- The repo fix lives at our boundary:
  pass `--build-upon-default-config` and keep a current-findings baseline.
