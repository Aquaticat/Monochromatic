# detekt 2.0.0-alpha.5 default config opt-in

## Symptom

Removing `--disable-default-rulesets` from the detekt CLI invocation still left
`mise run lint:detekt` green.

Default rule-set providers and default rule configuration are separate detekt concepts.
Default providers can load while their rules remain inactive when the run supplies a custom config
and does not also pass `--build-upon-default-config`.

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
- repo task `package/linter/kotlin/build.gradle.kts`,
  runner arguments at lines 76 to 80

The current check task passes `--build-upon-default-config`:

```kotlin
// package/linter/kotlin/build.gradle.kts:76-80
"--input", inputPath.get(),
"--config", configFile,
"--build-upon-default-config",
"--plugins", ruleJar.get().asFile.absolutePath,
"--excludes",
```

## What does not work

Removing `--disable-default-rulesets` alone does not activate default rule config.
It only changes provider loading.
The verification path that proved this was:

```sh
mise run lint:detekt
```

That command stayed green and printed zero findings until `--build-upon-default-config` was added.

## Upstream filing decision

No upstream issue should be filed.

- Upstream behavior is intentional:
  the CLI exposes separate flags for provider loading and default config composition.
- The repo fix lives at our boundary:
  pass `--build-upon-default-config` and fix findings surfaced by default rules.
