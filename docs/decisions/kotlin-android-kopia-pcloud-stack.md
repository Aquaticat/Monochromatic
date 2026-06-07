# Android UI/app-shell stack vet for the kopia-to-pCloud backup app

Status: per-technology vet and four-stack comparison complete. UI/app-shell stack decision is open
(not yet recorded). Date updated: 2026-06-07.

## Context

The planned app is Android-only. It runs kopia on the phone and backs up to pCloud without staging a
second copy on the device. kopia speaks S3, so the app stands up a local S3 endpoint that kopia targets
and translates those calls to pCloud's native API, streaming bytes through rather than buffering whole
objects.

Owner-decided and out of scope of this vet: running kopia on Android, the pCloud native API, and the
necessity of a custom S3 gateway.

Standard: choosing-technology full-verification. Every candidate was cloned, source-audited, and actually
built and run, in a bounded container or on the real device, not judged from metadata. The target device
is the owner's Pixel 6 (oriole), GrapheneOS, Android 16 / API 36. The repo is a TypeScript plus Rust
monorepo (mise, pnpm, cargo).

## Decisive result: run on the real device

All four UI stacks were built and launched on the physical Pixel 6:

- Native Jetpack Compose: runs. Counter increments; an in-app Ktor CIO server served HTTP 200.
- Compose Multiplatform: runs (desktop runComposeUiTest plus a debug APK on the device).
- Tauri v2: runs. The JavaScript to Rust command bridge works on device.
- Slint plus Rust: builds, but the UI crashes at startup. Slint's Android backend loads its Java helper
  only via dynamic code loading (`internal/backends/android-activity/javahelper.rs:251-307`,
  `InMemoryDexClassLoader`), which GrapheneOS blocks by default, raising a `SecurityException` before any
  UI renders. Disqualified for this device as shipped; the issue is unreported upstream.

## Candidate stacks

### Native Jetpack Compose (Kotlin)

Runs on the device. All-Kotlin: Compose UI, Ktor CIO as the local S3 server (verified in-app on the
device), OkHttp 5.3.2 / Retrofit 3.0.0 as the pCloud client (Retrofit pulls stable OkHttp 4.12.0),
WorkManager plus a dataSync Foreground Service for the backup.

Pros: one language and one build system, no FFI bridge; the app's hard parts (foreground service,
permissions, kopia binary exec, GrapheneOS handling) are first-class in Kotlin; strongest verified testing
(createAndroidComposeRule in-process plus Maestro black-box). Cons: a Kotlin/JVM/Gradle island in a
TypeScript plus Rust monorepo; the S3 gateway is written in Kotlin rather than reusing Rust.

### Tauri v2 (Rust core plus web UI)

Runs on the device. The S3 gateway stays in Rust (axum plus reqwest, verified streaming), the UI is
HTML/CSS/TypeScript, and a `gen/android` Gradle project provides the Android manifest and services.

Pros: keeps the gateway in Rust matching the monorepo; web UI suits the repo's TypeScript strength.
Cons: most polyglot of the options (Rust plus TypeScript plus Kotlin glue; cargo plus a JS bundler plus
Gradle); the UI runs in the Android System WebView; the desktop UI-test driver (tauri-driver) is
self-labeled pre-alpha, Linux and Windows only, with no native click support and no Playwright attach
path on WebKitGTK. It still needs the Gradle/Kotlin shell for the foreground service.

### Compose Multiplatform (Kotlin, multi-target)

Runs on the device. Same `androidx.compose` UI as native Jetpack plus the multiplatform layer and
runComposeUiTest. For an Android-only app the multiplatform layer adds version coupling and an AGP 9
migration off the stale official template for no benefit over native Jetpack. It earns its place only if
iOS or desktop becomes a real target.

### Slint plus Rust

Best repo fit on paper (pure Rust, matching the existing Slint desktop apps), and the Rust ecosystem core
is strong and DCL-free. But the Slint UI does not run on the owner's GrapheneOS device (see above), which
disqualifies it for the target device unless the per-app dynamic-code-loading restriction is disabled or
Slint upstream gains an app-classpath helper path.

## Ranking (analysis, not a recorded decision)

Native Jetpack Compose > Tauri v2 > Compose Multiplatform > Slint.

- Native Jetpack over Tauri: every viable stack needs a Gradle/Kotlin Android shell anyway for the
  foreground service and kopia bundling, so Tauri does not escape the JVM/Gradle island; it adds Rust plus
  a JS bundler on top of it. Native Jetpack is the only single-language, single-build option, with the
  best Android integration and the strongest verified testing. Its cost is rewriting the gateway in Kotlin,
  which was verified to work on the device.
- Tauri over Compose Multiplatform: Tauri is a genuinely different architecture (Rust core, web UI);
  Compose Multiplatform is a heavier native Jetpack for an Android-only app.
- Compose Multiplatform over Slint: Slint does not run on the device.

Flip conditions: if iOS or desktop becomes a real target, Compose Multiplatform rises above native Jetpack;
if keeping the gateway in Rust and out of the JVM is weighted highest, Tauri rises above native Jetpack.

The pick is a value judgment reserved to the owner; this document records the comparison, not a selection.

## Per-technology scorecard

S3-gateway core, Rust path (Tauri and Slint): axum 0.8.9 plus reqwest 0.13.4 streamed a 256 MiB object
end to end at about 8.2 MiB peak RSS, with pure-Rust TLS (rustls, no OpenSSL).

S3-gateway core, Kotlin path (Jetpack and Compose Multiplatform): Ktor CIO server verified in-app on the
device; OkHttp 5.3.2 / Retrofit 3.0.0 streaming client verified. Rejected: NanoHTTPD (dormant, blocking),
Spring Boot (too heavy), `java.net.http` (no Ktor-engine path).

Background execution (needed by every stack): WorkManager plus a dataSync Foreground Service verified
surviving backgrounding on the device. Constraint: apps targeting API 35+ get about 6 hours of dataSync
foreground-service time per 24 hours, after which `onTimeout` fires. A kopia snapshot can exceed that, so
backups must be chunked and resumable with onTimeout checkpointing, and the bulk transfer should use a
user-initiated data transfer job rather than a bare dataSync service.

Testing, in-process: runComposeUiTest (Compose Multiplatform, verified, offscreen, deterministic clock;
adopt the `v2` entry point since the classic one is deprecated in 1.12-alpha); createAndroidComposeRule
(native Jetpack, verified; pin androidx.test 3.7.0 / runner 1.7.0 / core 1.7.0 on Android 15/16);
slint::testing (verified headless, but text input is gated); tauri-driver (verified on Linux desktop but
pre-alpha, Linux and Windows only, no native clicks).

Testing, black-box end-to-end (the Playwright peer): Maestro verified driving native Compose via testTag
(`Modifier.semantics { testTagsAsResourceId = true }`), single binary, self-cleaning; the recommended
peer for native Android. Appium plus the uiautomator2 driver also verified (W3C, heavier; locate via
`-android uiautomator` or accessibility-id). UiAutomator is the shared primitive both wrap.

Fuzzing: Jazzer (`com.code-intelligence:jazzer`, on Maven Central, JUnit5 `@FuzzTest`) verified, found a
planted crash in a Kotlin parser in under a second and emitted a reproducer. It is the JVM fuzzer to use.
kotlinx.fuzz is disqualified: uninstallable (its only artifact host is NXDOMAIN, not on Maven Central,
plugin-portal publish disabled), and it is a research-lab project, not an official Kotlin library. For the
Rust path, cargo-fuzz (the repo incumbent) is verified.

Mutation testing: Pitest works on Kotlin (a sample scored 16 mutations, 12 killed) but its open-source
Kotlin support is a self-described "quick dirty hack" (`KotlinFilter.java:14-52`), with proper handling
paywalled behind the commercial Arcmutate plugin. For the Rust path, cargo-mutants 27.x is verified and is
effectively the only maintained Rust option. Mutation testing is optional either way.

Property testing: Kotest (verified, with shrinking) on the Kotlin path; proptest 1.x (verified, integrated
shrinking) on the Rust path. kotlin.test is the minimal Kotlin assertion layer (verified), pair it with
JUnit5.

## Cross-cutting Android constraints (any stack)

- GrapheneOS device: INTERNET is a revocable per-app permission (default off), so the app must request
  Network access; dynamic code loading is restricted (this is what disqualifies Slint's UI).
- Foreground-service time cap (API 35+): about 6 hours of dataSync per 24 hours; design backups as
  chunked, resumable, onTimeout-checkpointed, and prefer a user-initiated data transfer job for bulk.
- kopia binary: ship per ABI as `jniLibs/<abi>/lib*.so` with `extractNativeLibs=true`, and exec it from
  `nativeLibraryDir` (W^X since API 29). This is language-neutral.
- Native shared objects need 16 KB page alignment on Android 15/16 (hit during the Slint build, fixed with
  `-Wl,-z,max-page-size=16384`); relevant to the kopia `.so` and any Rust `.so`.

## Evidence

Sixteen per-technology full-verification vets were run this session, each producing a report with exact
commands, outputs, and source citations. The load-bearing numbers and version pins are inlined above so
this document stands alone. The full raw reports are persisted alongside this doc under
`kotlin-android-kopia-pcloud-vet-reports/` (verbatim agent output, not lint-conformed):

- Stacks: `vet-jetpack-compose.md`, `vet-compose.md`, `vet-tauri.md`, `vet-slint-rust.md`.
- Gateway core: `vet-ktor.md`, `vet-okhttp.md`, `vet-rust-http-core.md`.
- Background and runtime: `vet-android-runtime.md`.
- Testing: `vet-slint-testing.md`, `vet-tauri-driver.md`, `vet-android-e2e.md`, `vet-test-frameworks.md`.
- Fuzz and mutation: `vet-jazzer.md`, `vet-kotlinx-fuzz.md`, `vet-pitest.md`, `vet-rust-qa.md`.

## Out of scope (owner-decided)

Running kopia on Android, the pCloud native API, and whether the custom S3 gateway is necessary are
product and architecture decisions made by the owner and are not assessed here.
