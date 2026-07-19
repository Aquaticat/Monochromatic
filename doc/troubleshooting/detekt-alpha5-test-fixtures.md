# detekt 2.0.0-alpha.5 detekt-test requests unpublished detekt-api test fixtures

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

## Symptom

Adding detekt version `2.0.0-alpha.5` rule-test support
with a plain Gradle dependency
fails during `testRuntimeClasspath` resolution:

```text
# package/linter/kotlin, command output from `mise run //package/linter/kotlin:test`
Could not resolve dev.detekt:detekt-api:2.0.0-alpha.5.
No matching variant of dev.detekt:detekt-api:2.0.0-alpha.5 with capability
'dev.detekt:detekt-api-test-fixtures' was found.
```

The trigger pattern is:

```kotlin
// package/linter/kotlin/build.gradle.kts, failing shape
dependencies {
    testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5")
}
```

The successful consumer-side pattern keeps `detekt-test`,
removes its transitive request for the unpublished fixture capability,
and adds the normal API jar explicitly:

```kotlin
// package/linter/kotlin/build.gradle.kts, working shape
dependencies {
    testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5") {
        exclude(group = "dev.detekt", module = "detekt-api")
    }
    testImplementation("dev.detekt:detekt-api:2.0.0-alpha.5")
}
```

## Root cause

The source inspected was `detekt/detekt` tag `v2.0.0-alpha.5`,
commit `9c6ced63392cb451b7091dda25a9653875d275b6`,
cloned from `https://github.com/detekt/detekt.git`
into `/tmp/agent/detekt-alpha5-1781814037`.

`detekt-test` publishes a runtime dependency
on `detekt-api` test fixtures.
The source line is:

```text
/tmp/agent/detekt-alpha5-1781814037/detekt-test/build.gradle.kts:9
```

```kotlin
// /tmp/agent/detekt-alpha5-1781814037/detekt-test/build.gradle.kts
implementation(testFixtures(projects.detektApi))
```

The published Gradle module metadata turns that project test-fixture dependency
into a requested capability.
The local Gradle cache copy for the published artifact has `requestedCapabilities` at this path:

```text
/var/home/user/.gradle/caches/modules-2/files-2.1/dev.detekt/detekt-test/2.0.0-alpha.5/b4f812abc7d59a9436e83ff31f078d3ef6c49ea6/detekt-test-2.0.0-alpha.5.module:88
```

```json
{
  "group": "dev.detekt",
  "module": "detekt-api",
  "version": {
    "requires": "2.0.0-alpha.5"
  },
  "requestedCapabilities": [
    {
      "group": "dev.detekt",
      "name": "detekt-api-test-fixtures"
    }
  ]
}
```

`detekt-api` does define test fixtures.
The source line is:

```text
/tmp/agent/detekt-alpha5-1781814037/detekt-api/build.gradle.kts:20
```

```kotlin
// /tmp/agent/detekt-alpha5-1781814037/detekt-api/build.gradle.kts
testFixturesApi(libs.kotlin.compiler)
```

But the same build file removes the test-fixture API and runtime variants
from the Java component.
The relevant source range is:

```text
/tmp/agent/detekt-alpha5-1781814037/detekt-api/build.gradle.kts:43 to 47
```

```kotlin
// /tmp/agent/detekt-alpha5-1781814037/detekt-api/build.gradle.kts
listOf(configurations.testFixturesApiElements, configurations.testFixturesRuntimeElements).forEach { config ->
    config.configure {
        javaComponent.withVariantsFromConfiguration(this) {
            skip()
        }
    }
}
```

The resulting published `detekt-api` metadata exposes only test-fixture sources,
not a runtime jar variant.
The local Gradle cache copy has `testFixturesSourcesElements` at this path:

```text
/var/home/user/.gradle/caches/modules-2/files-2.1/dev.detekt/detekt-api/2.0.0-alpha.5/f4593fef8766b89930c4f73d60cbbbdc80446281/detekt-api-2.0.0-alpha.5.module:130
```

The fixture capability is at line `148`,
but there is no matching runtime library variant.

Gradle is therefore asked to resolve a capability
that the published module metadata does not provide as a jar.
That mismatch produces the `No matching variant` error.

## Verification

Version under test:

- detekt `2.0.0-alpha.5`
- Gradle `9.5.1`,
  via `package/linter/kotlin/gradlew`
- Kotlin Gradle plugin `2.4.0`
- JDK `21`,
  via mise Temurin

Failing catalog:

- Plain `testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5")` fails
  `mise run //package/linter/kotlin:test`
  during `:testRuntimeClasspath` resolution
  with the `detekt-api-test-fixtures` no-matching-variant error quoted above.

Working catalog:

- Current `package/linter/kotlin/build.gradle.kts` excludes `dev.detekt:detekt-api`
  from `detekt-test`
  and adds `testImplementation("dev.detekt:detekt-api:$detektVersion")` explicitly.
- `mise run //package/linter/kotlin:test` passed after the workaround:

```text
# /var/home/user/Monochromatic
BUILD SUCCESSFUL in 5s
5 actionable tasks: 1 executed, 4 up-to-date
```

- `mise run //package/linter/kotlin:lint` passed:

```text
# /var/home/user/Monochromatic
BUILD SUCCESSFUL in 3s
4 actionable tasks: 4 up-to-date
```

- `mise run //package/linter/kotlin:lint:detekt` passed,
  exercising the detekt 2 CLI with the custom plugin jar:

```text
# /var/home/user/Monochromatic
BUILD SUCCESSFUL in 6s
4 actionable tasks: 1 executed, 3 up-to-date
```

- `mise run lint:detekt` reached analysis
  and failed with existing `RequireKDoc` findings in the Android app,
  not with dependency or configuration errors.
  The root task already documents that pre-existing undocumented declarations
  keep it red until issue `#253` is resolved.

## Upstream prototype

Fresh prototype clone:

```text
/tmp/agent/detekt-alpha5-prototype-KQgY5o
```

Origin and tag were verified before editing:

```text
https://github.com/detekt/detekt.git
9c6ced63392cb451b7091dda25a9653875d275b6
v2.0.0-alpha.5
```

The minimal upstream patch publishes `detekt-api`'s test-fixture runtime variant
while continuing to hide the test-fixture API variant:

```diff
# /tmp/agent/detekt-alpha5-prototype-KQgY5o/detekt-api/build.gradle.kts
@@ -40,11 +40,9 @@ tasks {
 }
 
 val javaComponent = components["java"] as AdhocComponentWithVariants
-listOf(configurations.testFixturesApiElements, configurations.testFixturesRuntimeElements).forEach { config ->
-    config.configure {
-        javaComponent.withVariantsFromConfiguration(this) {
-            skip()
-        }
+configurations.testFixturesApiElements.configure {
+    javaComponent.withVariantsFromConfiguration(this) {
+        skip()
     }
 }
```

Before the patch,
a disposable consumer project reproduced the failure with this task:

```kotlin
// /tmp/agent/detekt-consumer-before-P7uAER/build.gradle.kts
tasks.register("resolveTestRuntime") {
    doLast {
        configurations.testRuntimeClasspath.get().files.forEach { println(it.name) }
    }
}
```

Command:

```sh
# /var/home/user/Monochromatic
GRADLE_USER_HOME=/tmp/agent/detekt-gradle-home \
  /tmp/agent/detekt-alpha5-prototype-KQgY5o/gradlew \
  --project-dir /tmp/agent/detekt-consumer-before-P7uAER \
  resolveTestRuntime \
  --no-daemon \
  --console=plain
```

Output:

```text
> Could not resolve dev.detekt:detekt-api:2.0.0-alpha.5.
  No matching variant of dev.detekt:detekt-api:2.0.0-alpha.5 with capability
  'dev.detekt:detekt-api-test-fixtures' was found.
```

After the patch,
the prototype was published to a disposable Maven repository.
The clone's `Versions.DETEKT` constant was locally set to `2.0.0-alpha.5`
only so the local publication used the affected release coordinate;
that version edit is not part of the upstream fix diff above.

Command:

```sh
# /var/home/user/Monochromatic
env -i \
  HOME=/tmp/agent/detekt-proto-home \
  PATH="$PATH" \
  JAVA_HOME="${JAVA_HOME:-}" \
  GRADLE_USER_HOME=/tmp/agent/detekt-gradle-home \
  /tmp/agent/detekt-alpha5-prototype-KQgY5o/gradlew \
  -Dmaven.repo.local=/tmp/agent/detekt-proto-m2 \
  --project-dir /tmp/agent/detekt-alpha5-prototype-KQgY5o \
  :detekt-api:publishToMavenLocal \
  :detekt-test:publishToMavenLocal \
  --no-daemon \
  --console=plain
```

Output:

```text
BUILD SUCCESSFUL in 25s
40 actionable tasks: 17 executed, 13 from cache, 10 up-to-date
```

The patched published metadata includes a runtime fixture variant:

```text
/tmp/agent/detekt-proto-m2/dev/detekt/detekt-api/2.0.0-alpha.5/detekt-api-2.0.0-alpha.5.module:130:      "name": "testFixturesRuntimeElements",
/tmp/agent/detekt-proto-m2/dev/detekt/detekt-api/2.0.0-alpha.5/detekt-api-2.0.0-alpha.5.module:189:          "name": "detekt-api-test-fixtures",
```

A second disposable consumer resolved the same dependency successfully
from `/tmp/agent/detekt-proto-m2` ahead of Maven Central.

Command:

```sh
# /var/home/user/Monochromatic
GRADLE_USER_HOME=/tmp/agent/detekt-gradle-home \
  /tmp/agent/detekt-alpha5-prototype-KQgY5o/gradlew \
  --project-dir /tmp/agent/detekt-consumer-after-KnWsL1 \
  resolveTestRuntime \
  --no-daemon \
  --console=plain
```

Output:

```text
> Task :resolveTestRuntime
detekt-test-2.0.0-alpha.5.jar
detekt-api-2.0.0-alpha.5-test-fixtures.jar
detekt-api-2.0.0-alpha.5.jar
detekt-test-utils-2.0.0-alpha.5.jar

BUILD SUCCESSFUL in 6s
1 actionable task: 1 executed
```

## Verified workarounds

### Consumer-side Gradle exclusion

Patch:

```diff
# package/linter/kotlin/build.gradle.kts
 dependencies {
-    testImplementation("dev.detekt:detekt-test:$detektVersion")
+    testImplementation("dev.detekt:detekt-test:$detektVersion") {
+        exclude(group = "dev.detekt", module = "detekt-api")
+    }
+    testImplementation("dev.detekt:detekt-api:$detektVersion")
 }
```

Tradeoff:

- This keeps `dev.detekt.test.lint` and `TestConfig` available for rule tests.
- It will fail at compile time or runtime
  if the consumer uses `detekt-test` APIs that reference `dev.detekt.api.testfixtures`.
  For example,
  `FileProcessListenerExtensions.kt` imports `dev.detekt.api.testfixtures.TestDetektion`.
- It is safe for `package/linter/kotlin`
  because the tests only call the rule `lint` helper and `TestConfig`.

### Pinning an older alpha

Detekt `2.0.0-alpha.3` avoids the Kotlin 2.4 metadata requirement,
but it is not the selected fix for this repo
because the current upgrade target is the latest published alpha.
Use this only when latest-alpha parity is less important
than avoiding the metadata workaround.

## What does not work

- Adding only `testRuntimeOnly("dev.detekt:detekt-api:2.0.0-alpha.5")` does not help
  when `detekt-test` still contributes the bad requested capability.
  Gradle fails before the normal API jar can satisfy the fixture capability.
- Excluding `detekt-api` from `detekt-test`
  without adding the normal `detekt-api` jar back
  breaks test compilation.
  The tests then cannot access `dev.detekt.api.Rule`,
  `Finding`,
  or `Config`.
- Upgrading only detekt without upgrading the Kotlin Gradle plugin fails compilation
  because detekt `2.0.0-alpha.5` is compiled with Kotlin `2.4.0` metadata,
  while Kotlin `2.2.10` can only read metadata through `2.3.0`.

## Upstream filing decision

`.out-of-scope/` was checked.
No detekt-specific exemption exists.

Duplicate search checked open and closed issues and PRs in `detekt/detekt` for:

- `detekt-api-test-fixtures detekt-test alpha.5`
- `testFixtures detekt-api`

No matching issue or PR was found.

Constraint check:

- Constraint 1:
  upstream fault,
  yes.
  `detekt-test` publishes a dependency on `detekt-api` test fixtures,
  while `detekt-api` skips publishing the fixture API and runtime variants.
- Constraint 2:
  upstream can fix it,
  yes.
  Plausible fixes include publishing the fixture runtime variant,
  removing the public `detekt-test` dependency on `detekt-api` test fixtures,
  or moving the needed fixture helpers into a published module.
- Constraint 3:
  supported use case,
  yes.
  The detekt extension docs for `2.0.0-alpha.5` tell custom-rule authors
  to add `testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5")`.
- Constraint 4:
  contribution welcome,
  yes with human review.
  `.github/CONTRIBUTING.md` welcomes community contributions
  and allows AI-assisted contributions when they reflect human scrutiny.
  The bug template asks for expected behavior,
  observed behavior,
  reproduction steps,
  context,
  and environment.
- Constraint 5:
  likely to be fixed,
  unknown but plausible.
  No duplicate or maintainer rejection was found,
  and this is an alpha publication metadata issue.
- Constraint 6:
  prototype,
  yes.
  The disposable upstream patch publishes `testFixturesRuntimeElements` for `detekt-api`,
  and a disposable consumer resolved `detekt-test:2.0.0-alpha.5`
  with `detekt-api-2.0.0-alpha.5-test-fixtures.jar` on the runtime classpath.

Draft issue:

~~~md
Title: detekt-test 2.0.0-alpha.5 requests an unpublished detekt-api-test-fixtures runtime variant

Labels: bug

## Expected Behavior

A custom rule project can add:

```kotlin
testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5")
```

and resolve `testRuntimeClasspath` from Maven Central.

## Observed Behavior

Gradle fails dependency resolution with:

```text
No matching variant of dev.detekt:detekt-api:2.0.0-alpha.5 with capability
'dev.detekt:detekt-api-test-fixtures' was found.
```

## Steps to Reproduce

Create a JVM Gradle project with Kotlin `2.4.0`,
Maven Central,
and:

```kotlin
dependencies {
    testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5")
}
```

Run a test task or resolve `testRuntimeClasspath`.

## Context

The published `detekt-test` Gradle metadata requests the `dev.detekt:detekt-api-test-fixtures`
capability because `detekt-test/build.gradle.kts` has:

```kotlin
implementation(testFixtures(projects.detektApi))
```

But `detekt-api/build.gradle.kts` skips both `testFixturesApiElements`
and `testFixturesRuntimeElements` from publication:

```kotlin
listOf(configurations.testFixturesApiElements, configurations.testFixturesRuntimeElements).forEach { config ->
    config.configure {
        javaComponent.withVariantsFromConfiguration(this) {
            skip()
        }
    }
}
```

The consumer-side workaround for rule tests
that only use `lint` and `TestConfig` is:

```kotlin
testImplementation("dev.detekt:detekt-test:2.0.0-alpha.5") {
    exclude(group = "dev.detekt", module = "detekt-api")
}
testImplementation("dev.detekt:detekt-api:2.0.0-alpha.5")
```

That workaround is incomplete for consumers using `detekt-test` APIs
that reference `dev.detekt.api.testfixtures`.

## Suggested fix

Publish `detekt-api`'s test-fixture runtime variant,
while continuing to skip the test-fixture API variant:

```diff
@@ -40,11 +40,9 @@ tasks {
 }
 
 val javaComponent = components["java"] as AdhocComponentWithVariants
-listOf(configurations.testFixturesApiElements, configurations.testFixturesRuntimeElements).forEach { config ->
-    config.configure {
-        javaComponent.withVariantsFromConfiguration(this) {
-            skip()
-        }
+configurations.testFixturesApiElements.configure {
+    javaComponent.withVariantsFromConfiguration(this) {
+        skip()
     }
 }
```

I verified this patch by publishing `detekt-api` and `detekt-test`
to a disposable Maven repository,
then resolving `testRuntimeClasspath` in a disposable consumer project.
The successful runtime classpath contained:

```text
detekt-test-2.0.0-alpha.5.jar
detekt-api-2.0.0-alpha.5-test-fixtures.jar
detekt-api-2.0.0-alpha.5.jar
detekt-test-utils-2.0.0-alpha.5.jar
```

## Environment

- detekt `2.0.0-alpha.5`
- Gradle `9.5.1`
- Kotlin Gradle plugin `2.4.0`
- JDK `21`
~~~
