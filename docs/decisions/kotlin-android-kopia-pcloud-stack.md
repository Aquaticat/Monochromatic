# Kotlin tooling stack for the Android kopia-to-pCloud backup app

Status: accepted (tooling go/no-go). Date: 2026-06-07.

## Context

The planned app is an Android-only application whose job is to run kopia on the phone and back up to
pCloud without staging a second copy of the data on the device. kopia speaks S3, so the app stands up
a local S3 endpoint that kopia targets, and the app translates those S3 calls to pCloud's native API,
streaming bytes through rather than buffering whole objects on disk.

Three load-bearing pieces are owner-decided and explicitly out of scope of this vet:
running kopia on Android, the pCloud native API, and the necessity of a custom S3 gateway.
This document only records the Kotlin tooling decisions and the evidence behind them.

Each candidate below was vetted to the full-verification bar in the choosing-technology skill:
cloned upstream, source-audited, and actually built and run in a bounded container or on the device,
not judged from metadata. Reports live under `/tmp/agent/vet-*.md` for this session.

## Decision: go

The Kotlin tooling needed to build this app all clears the "good enough" bar. The single tool that did
not (kotlinx.fuzz) has a maintained drop-in replacement, and the one weak tool (Pitest on Kotlin) is an
optional nice-to-have, so neither blocks the build.

## Stack

### Language and build: Kotlin plus Gradle (Kotlin DSL)

Kotlin builds reproducibly from source: an earlier in-container `./gradlew dist` produced a working
`kotlinc 2.4.255-SNAPSHOT` that compiled and ran a program. Gradle is mandatory for Android and Compose.

Caveat: this app is a Gradle/JVM/Android island inside a mise plus pnpm plus Rust monorepo. It does not
share the repo's oxlint/tsgo/dprint/tsdown toolchain. Treat it as a self-contained package with its own
Gradle build, wired into mise only at the task boundary.

### UI: Compose Multiplatform plus runComposeUiTest

Verified on both boundaries on the current stack (Kotlin 2.3.20, Compose 1.11.1, AGP 9.2.1, Gradle 9.5.0):
a desktop `runComposeUiTest` test passed headless, and a debug APK installed, launched, and incremented a
counter on the physical Pixel 6 (Android 16). It is genuine AOSP Jetpack Compose (Apache-2.0) plus
JetBrains targets; JetBrains-maintained, daily commits, monthly releases.

Note on fit: the goal is Android-only, and for Android-only UI native Jetpack Compose is the lighter
choice (identical `androidx.compose` API, no multiplatform plumbing). Compose Multiplatform is the chosen
path anyway; it loses nothing on Android and keeps a desktop/iOS door open. Rejected alternatives: Flutter
(adds Dart, a third language runtime), React Native (weak Linux-desktop story, no offscreen component test
runner), Slint (the repo's desktop incumbent, but mobile-immature and no semantics-tree UI test harness).

runComposeUiTest was the smoothest component: clean multiplatform expect/actual, offscreen Skiko rendering
needing no display, deterministic `mainClock`/`waitForIdle`, self-tested upstream. Plan to adopt the `v2`
entry point: the classic `runComposeUiTest` is `@Deprecated(WARNING)` as of 1.12-alpha. Rejected
alternatives: Espresso (Android-only, View-centric, subsumed by the Android actual), Maestro (black-box
E2E, no semantics access, needs a running device).

### Local S3 server and pCloud client: Ktor

Verified: a Ktor CIO server plus client round-tripped a known body in a container. Ktor is the natural fit
for both halves of the gateway: an embedded CIO server on Android to expose the local S3 endpoint kopia
targets, and the Ktor client (OkHttp engine) to call the pCloud native API. Coroutine streaming bodies
match the "do not duplicate storage on the phone" constraint: stream S3 PUT bodies straight to pCloud
uploads and pCloud downloads straight back to S3 GET responses, with backpressure.

Gap to watch: Ktor ships no fuzzing, property, mutation, or lincheck tests despite a concurrent core, and
upstream CI is JetBrains-internal TeamCity, not public. Rejected alternatives for the local server:
NanoHTTPD (blocking I/O, no coroutine streaming ergonomics, thin maintenance), Spring Boot (far too heavy
for an embedded on-device server).

### HTTP engine: OkHttp (under Ktor client)

Verified: a live HTTPS GET returned 200 in a container. Fail-closed TLS, lean dependencies (Okio plus
stdlib), broad CI. Use it as the Ktor client engine on Android rather than standalone. Rejected
alternative: `java.net.http` (no Ktor-engine integration path, fewer Android-tuned connection controls).

### Tests: kotlin.test plus Kotest, with runComposeUiTest for UI

kotlin.test (verified) is the minimal assertion plus `@Test` layer; pair it with JUnit5 as the engine.
Kotest (verified, including property tests with shrinking) earns its place specifically for the S3-to-pCloud
translation: property tests over generated S3 request shapes and byte ranges are the right tool for
checking the gateway's correctness. Caution: Kotest maintenance is concentrated on a single maintainer
(sksamuel); active releases, but a real bus-factor note. Rejected alternatives: JUnit5 alone (no property
testing or multiplatform), Spek (effectively dormant), Spock (forces Groovy).

### Fuzzing the S3 request surface: Jazzer (not kotlinx.fuzz)

kotlinx.fuzz is rejected: it cannot be installed or built today. Its only artifact host
(`plan-maven.apal-research.com`) is NXDOMAIN, it is not on Maven Central, and the Gradle Plugin Portal
publish step is disabled. It is also `JetBrains-Research/kotlinx.fuzz`, a research-lab project, not an
official Kotlin library (the name oversells it), last released roughly 14 months ago. Following its README
fails at plugin resolution; building from source fails resolving its forked Jazzer. Impractical to verify,
so disqualified.

Use Jazzer directly (`com.code-intelligence:jazzer`, `jazzer-junit`, on Maven Central, JUnit5 `@FuzzTest`)
for coverage-guided fuzzing. This matters here: the S3 requests kopia sends are a peer-controlled parsing
boundary, exactly the kind of input the repo's syntax-boundary rules want fuzzed. Property-based options
(jqwik, Kotest property) are not coverage-guided and do not replace it for crash discovery.

### Mutation testing: Pitest, optional and eyes-open

Pitest works on Kotlin (a sample run scored 16 mutations, 12 killed, 75 percent), but its open-source
Kotlin support is a self-described "quick dirty hack" (`KotlinFilter.java:14-52` in the clone), and proper
Kotlin handling is paywalled behind the same maintainer's commercial Arcmutate plugin, which Pitest nags
for on every Kotlin run. Single-maintainer bus factor. Treat mutation testing as optional: adopt only if
the team will tolerate equivalent-mutant noise on richer Kotlin, or skip it. Rejected alternative:
Arcmutate (closed-source, paid; violates the open-source default, name only as the commercial exception).

## Adoption caveats (budget for these)

- The official Compose Multiplatform template is roughly 2.5 years stale and does not build on AGP 9.
  Use `com.android.kotlin.multiplatform.library` for the shared module and plain `com.android.application`
  for the app, per JetBrains' current examples, not the template's broken `com.android.library` plus
  kotlin-multiplatform combo.
- Build requires JDK 21 to run AGP 9 even though the compile target stays Java 17.
- Pin a known-good (Kotlin, compose-compiler, Compose, AGP, Gradle) set and bump them together; the coupling
  is tight and the wizard lags the release train.
- Handle edge-to-edge insets on modern Android (targetSdk 36 draws under the status bar and camera cutout).

## Evidence index

- `/tmp/agent/vet-compose.md`: Compose Multiplatform plus runComposeUiTest, desktop and Pixel 6 runs.
- `/tmp/agent/vet-ktor.md`: Ktor server plus client round-trip.
- `/tmp/agent/vet-okhttp.md`: OkHttp live HTTPS request.
- `/tmp/agent/vet-test-frameworks.md`: kotlin.test and Kotest green runs.
- `/tmp/agent/vet-kotlinx-fuzz.md`: kotlinx.fuzz install failure and disqualification.
- `/tmp/agent/vet-pitest.md`: Pitest Kotlin mutation run and the Arcmutate upsell finding.

## Out of scope (owner-decided)

Running kopia on Android, the pCloud native API, and whether the custom S3 gateway is necessary are
product and architecture decisions made by the owner and are not assessed here.
