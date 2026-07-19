# Vetting: kotlin.test vs Kotest (Kotlin testing technologies)

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Date:
 2026-06-07.
 Standard applied:
 choosing-technology skill,
 FULL-VERIFICATION level,
 both candidates.

Both candidates were cloned,
 source-audited,
 maintenance-checked via gh,
 and run to green in a
bounded podman container.
 Both pass full verification.
 Neither is disqualified.
 Summary verdicts are
at the end of each section,
 with alternatives and rejection reasons.

## Candidate 1: kotlin.test

Source inspected in the existing Kotlin checkout at
`/tmp/agent/kotlin-20260607/libraries/kotlin.test` (JetBrains/kotlin).
 License Apache-2.0
(per file headers,
 e.g. `common/src/main/kotlin/kotlin/test/Assertions.kt:1-3`).

### Architecture: assertion + annotation facade, not a runner

kotlin.
test is a multiplatform assertion API plus a test-annotation mapping layer.
 It does not run
tests itself;
 on the JVM it delegates to JUnit4/JUnit5/TestNG,
 and on JS to Jasmine/Mocha/Jest
(`Module.md`).

- Public assertion API:
   `common/src/main/kotlin/kotlin/test/Assertions.kt` (848 lines).
   The
  `asserter` property is the indirection point (`Assertions.kt:26-27`:
   `get() = _asserter ?:
  lookupAsserter()`);
   `assertEquals`/`assertTrue`/etc. delegate to it (`Assertions.kt:42-103`).
- Runner abstraction:
   the `Asserter` interface (`Assertions.kt:743-834`) and `AsserterContributor`
  (`Assertions.kt:839-846`).
   A `DefaultAsserter` throws plain `AssertionError`
  (`common/src/main/kotlin/kotlin/test/DefaultAsserter.kt:11-23`).
- JVM lookup:
   `jvm/src/main/kotlin/AsserterLookup.kt:10-18` loads `AsserterContributor` via
  `java.util.ServiceLoader` and falls back to `DefaultAsserter`.
- JUnit5 delegation:
   `junit5/src/main/kotlin/JUnitSupport.kt:30-67` (`JUnit5Asserter` forwards to
  `org.junit.jupiter.api.Assertions`).
- Annotation mapping proves the runner dependency:
   `junit/src/main/kotlin/Annotations.kt:12-15`
  declares `public actual typealias Test = org.junit.Test` (JUnit5 variant aliases to Jupiter).
   So
  on the JVM kotlin.
  test needs JUnit/TestNG as the actual engine.

### Tests, CI, property/fuzz/mutation

- Self-tests:
   `common/src/test/.../BasicAssertionsTest.kt` (380 lines),
   `AssertContainsTest.kt`
  (166),
   `AssertContentEqualsTest.kt` (160),
   plus three JVM tests under `jvm/src/test`.
   These are
  the library's own assertion tests;
   CI is the whole JetBrains/kotlin build pipeline (kotlin.
  test is
  a module of the compiler/stdlib repo,
   not separately CI'd).
- Property testing:
   none.
   `rg` for `forAll|propertyTest|quickcheck|fuzz|mutation` across the module
  returns zero source hits (only the word "property" appears in TSDoc-style prose at
  `Assertions.kt:599+` meaning object properties).
- Fuzzing / mutation testing:
   none,
   reported as absent.
- Module sizes:
   core total ~1299 lines;
   largest file `Assertions.kt` 848 lines.
   Small and focused.

### Maintenance

JetBrains/kotlin:
 52,832 stars,
 `pushedAt` 2026-06-07 (today).
 Latest release Kotlin 2.4.0 on
2026-06-03 (2.3.21 on 2026-04-23).
 kotlin.
test ships with every Kotlin release;
 corporate-backed by
JetBrains with a large team.
 Maintenance health:
 strongest possible (it is part of the language
distribution).

### Verdict: kotlin.test

Works (verified below).
 The standard,
 JetBrains-maintained,
 multiplatform assertion + annotation
layer.
 It is deliberately minimal:
 no runner of its own (needs JUnit5/TestNG on the JVM),
 no property
testing,
 no fuzzing,
 no mutation testing.
 Use it when all you want is the idiomatic
`assertEquals`/`assertTrue` surface and `@Test` annotations while bringing your own engine.
 Clean
record.

Two alternatives with rejection reasons:

- JUnit5 (JUnit Jupiter).
   This is actually what kotlin.
  test delegates to on the JVM,
   so it is
  complementary rather than a true competitor.
   As a standalone choice it is rejected for the
  multiplatform goal:
   it is JVM-only and cannot back Kotlin/JS,
   Native,
   or Wasm test sources,
   whereas
  kotlin.
  test presents one assertion API across all targets.
- AssertJ.
   Rejected as the assertion layer:
   JVM-only (no multiplatform),
   exposes a Java-fluent
  `assertThat(x).isEqualTo(y)` API rather than Kotlin-idiomatic top-level functions,
   and pulls in a
  larger dependency for the same basic equality/null checks kotlin.
  test already covers.

## Candidate 2: Kotest

Cloned fresh:
 `gh repo clone kotest/kotest /tmp/agent/kotest-vet -- --depth 1`.
 License Apache-2.0
(`LICENSE`).
 4,776 stars.
 Self-description:
 "Powerful,
 elegant and flexible test framework for Kotlin
with assertions,
 property testing and data driven tests.
"

### Architecture: full framework

- Engine / runner:
   `kotest-framework/kotest-framework-engine/src/commonMain/.../engine/TestEngine.kt`
  (191 lines),
   `TestEngineLauncher.kt`,
   and `test/TestCaseExecutor.kt` (126 lines).
   Platform runners
  live in `kotest-runner/` (`kotest-runner-junit4`,
   `-junit5`,
   `-junit6`,
   `-junit-platform`).
- Matchers / assertions:
   `kotest-assertions/kotest-assertions-shared/.../matchers/Matcher.kt`
  (the `Matcher` interface and `MatcherResult`) and the `shouldBe` DSL at
  `kotest-assertions/kotest-assertions-core/.../matchers/should.kt:21-27` (`infix fun <T> T.shouldBe`,
  routing to `EqMatcher`).
   Rich equality machinery under `kotest-assertions-core/.../assertions/eq/`
  (ArrayEq,
   CollectionEq,
   DataClassEq,
   etc.).
- Property testing (first class):
   `kotest-property/`.
   The core engine is
  `src/commonMain/.../property/internal/proptest.kt` (3597-line multifile with `proptest` overloads
  for 1..22 generators;
   1-arg at `:14`).
   `forAll` is defined per-arity (2-arg at
  `propertyTest2.kt:87`),
   `checkAll` likewise (1-arg at `propertyTest1.kt:14`).
   Generators:
  `Arb.int` (`arbitrary/ints.kt:35`),
   `Arb.string` (`arbitrary/strings.kt:19`).
   Shrinking is real:
  `internal/shrink.kt` (`doShrinking`/`doStep`,
   141 lines) walks the candidate `RTree` to find the
  smallest failing case and treats `assume()`-skipped iterations as passes.

### Tests, CI, mutation/fuzz

- Scale:
   1081 `*Main` Kotlin source files,
   1387 test-area Kotlin files.
   31 dedicated integration test
  modules under `kotest-tests/` (junit4,
   junit-jupiter,
   junitxml,
   spec/test parallelism,
   timeouts,
  config-*,
   power-assert,
   wasm-js,
   wasm-wasi,
   android-instrumentation,
   htmlreporter,
   and more).
- CI:
   `.github/workflows/master.yml` and `pr_main.yml` run a Gradle matrix across jvm / js / wasm /
  native and ubuntu / windows / macos;
   `codeql.yml` adds CodeQL security scanning.
- Mutation testing:
   present.
   Kotest ships `kotest-extensions/kotest-extensions-pitest` with
  `KotestPluginFactory.kt` implementing PITest's `org.pitest.testapi.TestPluginFactory`,
   so Kotest
  specs can be driven by PIT mutation runs.
- Fuzzing:
   no dedicated fuzz harness/corpus;
   the kotest-property generators plus shrinking cover the
  randomized-input space instead.
   Reported for completeness.

### Maintenance

`pushedAt` 2026-06-04 (3 days ago).
 Latest release 6.1.11 on 2026-04-04,
 with a rapid cadence
(6.1.7 -> 6.1.11 across March-April 2026).
 Maintainer responsiveness is high:
 owner sksamuel (Sam
Samuel) replied "This is an excellent idea" on issue #6107 within ~12 hours as a MEMBER,
 and engages
on others (#6094,
 #6106).
 Recent merged PRs are largely authored by sksamuel himself (#6105 "Use
Kotlin 2.4.0 as the compile toolchain",
 #6103 CI flake fix).
 Interpretation:
 actively released,
responsive triage,
 but activity is heavily concentrated on a single maintainer,
 which is the one
bus-factor caution to weigh.

### Verdict: Kotest

Works (verified below).
 A full multiplatform framework:
 engine plus JUnit-Platform runner,
 an
expressive Kotlin matcher DSL,
 first-class property testing with shrinking,
 and a PITest mutation
extension.
 Active releases and fast maintainer response.
 The single caution is maintainer
concentration on sksamuel.
 Recommended when you want property-based testing and/or an expressive
spec/matcher DSL on top of (or instead of) plain JUnit.

Two alternatives with rejection reasons:

- JUnit5 (JUnit Jupiter).
   Rejected versus Kotest for this role:
   JVM-only (no Kotlin Multiplatform
  JS/Native/Wasm),
   no built-in property testing or shrinking,
   no coroutine-native test bodies,
   and a
  Java-idiom API.
   Kotest runs on top of the JUnit Platform anyway,
   so adopting Kotest does not lose
  JUnit interop while adding the missing capabilities.
- Spek.
   Rejected:
   a Kotlin spec framework whose maintenance has effectively stalled (no recent
  release cadence comparable to Kotest's monthly patches),
   JVM-focused,
   and with no property-testing
  support.
   An effectively-dormant dependency is disqualifying against Kotest's active 6.1.
  x line.
- (Also considered) Spock:
   Groovy-based;
   rejected because it forces Groovy as the test language,
  cannot share Kotlin types/source cleanly,
   and has no Kotlin Multiplatform story.

## FULL VERIFICATION (both, one project)

A single minimal Gradle Kotlin project exercised both candidates together.
 Build artifacts,
 the
Gradle distribution,
 the Gradle user home,
 and the JVM temp dir all live on the disk-backed mount
under `/var/tmp/kt-vet` (not tmpfs).

Project files (`/var/tmp/kt-vet`):

- `build.gradle.kts`:
   Kotlin JVM plugin 2.1.20;
   deps `testImplementation(kotlin("test"))`,
  `io.kotest:kotest-runner-junit5:6.1.11`,
   `io.kotest:kotest-property:6.1.11`,
  `io.kotest:kotest-assertions-core:6.1.11`;
   `tasks.test { useJUnitPlatform() }`;
   `jvmToolchain(21)`.
- `src/test/kotlin/KotlinTestAssertions.kt`:
   two `@Test` methods using kotlin.
  test
  `assertEquals`/`assertTrue`/`assertNotNull`.
- `src/test/kotlin/KotestSpec.kt`:
   a `StringSpec` with a matcher-DSL test plus two property tests,
  `forAll(Arb.int(), Arb.int()) { a, b -> a + b == b + a }` and
  `checkAll(Arb.string()) { s -> s.reversed().reversed() shouldBe s }`.

Exact container command:

```bash
podman run --rm --memory=6g --cpus=4 \
  --volume /var/tmp/kt-vet:/work:Z --workdir /work \
  --tmpfs /tmp:rw,size=128m \
  docker.io/library/eclipse-temurin:21-jdk \
  bash /work/run-in-container.sh
```

Inside the container (Gradle 8.13,
 Temurin JDK 21.0.11;
 `GRADLE_USER_HOME` and `TMPDIR` under
`/work`):

```bash
gradle clean test --no-daemon --console=plain \
  -Dorg.gradle.jvmargs="-Djava.io.tmpdir=/work/.jtmp -Xmx3g"
```

Result:
 `BUILD SUCCESSFUL in 28s`,
 exit code 0.
 All five tests passed:

```text
KotestSpec > matcher DSL: list transform PASSED
KotestSpec > property: integer addition is commutative PASSED
KotestSpec > property: reversing a string twice is the identity PASSED
KotlinTestAssertions > collectionsAndNullability() PASSED
KotlinTestAssertions > additionWorks() PASSED
```

Both kotlin.
test assertions (running through the JUnit5 asserter on the JUnit Platform) and Kotest
(spec runner,
 matcher DSL,
 and the kotest-property `forAll`/`checkAll` generators with shrinking) ran
green in the same suite.
 Neither candidate is impractical to verify;
 both are confirmed working.

Notes on the path to green (for reproducibility):
 the SELinux-enforced host requires the `:Z` volume
relabel,
 and the `jar`-extracted Gradle launcher needs `chmod +x` (zip extraction does not preserve
the executable bit).
 Neither is a defect in the candidates.

## Bottom line

- kotlin.
  test:
   works,
   verified.
   Minimal multiplatform assertion + annotation API,
   JetBrains-
  maintained,
   no runner/property/fuzz/mutation of its own.
   Pair it with JUnit5/TestNG.
- Kotest:
   works,
   verified including property tests.
   Full framework with property testing,
   shrinking,
  rich matchers,
   and a PITest mutation extension;
   actively released;
   one bus-factor caution
  (sksamuel concentration).

The two are complementary,
 not strictly either/or:
 kotlin.
test is an assertion/annotation layer;
Kotest is a full framework that can also host kotlin.
test assertions via the JUnit Platform.
