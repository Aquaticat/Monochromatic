# OkHttp (square/okhttp) vetting report

Date:
 2026-06-07
Vetted commit:
 `7a350986e3231a7b81cbfcc6e3c185327033422b` (default branch `master`,
 committed 2026-06-03)
Latest stable release:
 5.3.2 (2025-11-18),
 resolved from Maven Central as `com.squareup.okhttp3:okhttp:5.3.2`
Clone:
 `/tmp/agent/okhttp-vet` (`gh repo clone square/okhttp ... --depth 1`)
License:
 Apache-2.0 (`LICENSE.txt`),
 open-source default satisfied.

## Verdict (read first)

OkHttp is a technically excellent,
 mature,
 actively maintained JVM HTTP client,
 and full
verification passed (real HTTPS GET returned HTTP 200,
 528-byte body).
 However it is a
Java/Kotlin library that runs only on the JVM.
 The Monochromatic monorepo has no JVM
runtime consumer:
 every package is TypeScript/Bun,
 Rust,
 or Zig.
 The only `.kt`/`.gradle`
files in the tree are inside a vendored zig-cache imgui example,
 and the one `intellij-plugin`
package (`islands-black`) is a static theme `.jar` built with TypeScript tooling,
 with no
Kotlin/Java source and no HTTP need.

Conclusion:
 REJECT for adoption in this repo on constraint-fit grounds.
 The library is sound;
there is simply no integration point.
 If a JVM service is ever added to this repo,
 OkHttp is a
strong default choice.
 For the current TS/Bun stack the right HTTP layer is the platform `fetch`
or `undici`,
 not a JVM client.

## 1. Full verification (required gate): PASS

Environment:
 bounded podman container,
 image `docker.io/library/eclipse-temurin:21-jdk`,
`--memory=6g --cpus=4`,
 network bridge.
 Build artifacts and Gradle home placed on disk under
`/var/tmp` (not tmpfs):
 project `/var/tmp/okhttp-verify`,
 `GRADLE_USER_HOME=/var/tmp/gradle-home`,
`TMPDIR=/var/tmp/okhttp-verify-build`.

Project:
 tiny Gradle (Kotlin DSL) app,
 Kotlin `kotlin("jvm") 2.2.20`,
 single dependency
`com.squareup.okhttp3:okhttp:5.3.2` from `mavenCentral()`.
 `Main.kt` performs a real HTTPS GET
to `https://example.com`,
 then asserts `code == 200` and non-empty body via `check(...)`.

Exact run command (host):

```bash
cd /var/tmp/okhttp-verify && podman run --rm \
  --memory=6g --cpus=4 --network=bridge \
  -v /var/tmp/okhttp-verify:/work:z \
  -v /var/tmp/gradle-home:/gradle-home:z \
  -v /var/tmp/okhttp-verify-build:/vartmp:z \
  -w /work -e GRADLE_USER_HOME=/gradle-home -e TMPDIR=/vartmp \
  docker.io/library/eclipse-temurin:21-jdk \
  bash /work/run-verify.sh
```

In-container command (`run-verify.sh`):

```bash
./gradlew --no-daemon --console=plain --version
./gradlew --no-daemon --console=plain -Dorg.gradle.jvmargs="-Djava.io.tmpdir=/vartmp -Xmx2g" run
```

Result (exit code 0):

```text
> Task :compileKotlin
> Task :run
HTTP_STATUS=200
BODY_LENGTH=528
VERIFICATION_PASSED okhttp:5.3.2 GET https://example.com -> 200, body=528 bytes
BUILD SUCCESSFUL in 24s
```

Gradle 9.5.1 (wrapper) downloaded and ran;
 Kotlin 2.2.20 compiled the app;
 OkHttp 5.3.2 + Okio
3.16.4 + kotlin-stdlib resolved from Maven Central.
 The integration boundary (compile against the
published artifact,
 then make a live TLS request) was crossed successfully.
 Not disqualified.

## 2. Source audit

Core module size:
 148 Kotlin source files,
 ~33,716 lines in `okhttp/src/{commonJvmAndroid,jvmMain}`.
Largest files are `HttpUrl.kt` (1816),
 `OkHttpClient.kt` (1394),
 `internal/cache/DiskLruCache.kt`
(1121),
 `internal/http2/Http2Connection.kt` (1046).
 Sizes are large but cohesive per concern.

Request execution path:
 `internal/connection/RealCall.kt:208` `getResponseWithInterceptorChain()`
builds the canonical interceptor stack (RealCall.
kt:
211-219):
 user interceptors,
`RetryAndFollowUpInterceptor`,
 `BridgeInterceptor`,
 `CacheInterceptor`,
 `ConnectInterceptor`,
network interceptors,
 `CallServerInterceptor`.
 `execute()` (RealCall.
kt:
180) guards single-use with
`compareAndSet`,
 enters a timeout,
 and uses a `finally` to notify the dispatcher.

Connection/TLS path:
 `internal/connection/ConnectPlan.kt`.
 `connectTlsEtc()` (line 158) selects the
SSL socket factory and connection spec;
 `connectTls()` (line 340) is the security-critical core and
is correctly fail-closed:

- forces the handshake (`sslSocket.startHandshake()`,
   line 352);
- verifies the hostname and throws `SSLPeerUnverifiedException` on mismatch,
   including the no-cert
  case (lines 358-374);
- runs the certificate pinner against the cleaned chain (lines 377-395);
- selects ALPN protocol only after verification (lines 398-406);
- in `finally`,
   closes the socket on any failure (`success` flag,
   lines 408-412).

Error-handling shape:
 throw-based with typed exceptions (`SSLPeerUnverifiedException`,
 `IOException`,
`RouteException`),
 `@Throws` annotations,
 and `finally`/`closeQuietly` cleanup.
 No silent swallowing
observed in the audited paths.
 This matches the repo's own PP4/PP7 throw-over-null preferences.

Transitive dependencies (parity-relevant):
 only two runtime deps,
 declared `api` in
`okhttp/build.gradle.kts:98-99`:
 `com.squareup.okio` (Okio,
 same maintainers) and `kotlin-stdlib`.
Confirmed by the resolved jars in the verify build cache:
 `okhttp-jvm-5.3.2.jar`,
 `okio-jvm-3.16.4.jar`.
A very lean dependency surface.

### Tests and CI

Test footprint:
 202 test source files repo-wide;
 142 under the core `okhttp/src` module.
 Named
suites cover the security- and protocol-critical surface directly:
 `CertificatePinnerTest`,
`CertificatePinnerChainValidationTest`,
 `CertificateChainCleanerTest`,
 `HandshakeTest`,
`CallHandshakeTest`,
 `ClientAuthTest`,
 `ConnectionReuseTest`,
 `ConnectionCoalescingTest`,
`ConnectionPoolTest`,
 `FastFallbackTest`,
 `CacheTest`/`CacheCorruptionTest`,
 `DiskLruCacheTest`,
plus HTTP/2,
 WebSocket,
 cookies,
 and per-provider suites (`ConscryptTest`,
 `CorrettoTest`,
`BouncyCastleTest`).

CI (`.github/workflows/build.yml`):
 GitHub Actions.
 Test matrix runs `./gradlew test allTests`
across JDK 8,
 11,
 17,
 21;
 a separate `openjdk8alpn` job;
 a `providers` matrix (openjsse,
bouncycastle,
 corretto,
 conscrypt);
 a GraalVM native-image `check`;
 Gradle wrapper validation and
Renovate config validation;
 JUnit reports published.
 `containers.yml`,
 `docs.yml`,
 `publish.yml`
round out container conformance,
 docs,
 and Maven Central publishing.
 This is broad,
 security-aware CI.

### Fuzzing / property / mutation testing

- WebSocket conformance fuzzing:
   present.
   `fuzzing/` wires the Autobahn `fuzzingserver` (see
  `fuzzing/fuzzingserver-config.json`,
   `fuzzing/fuzzingserver-test.sh`,
  `fuzzing/fuzzingserver-expected.txt`) to exercise the WebSocket implementation against the
  Autobahn malformed-frame test suite.
   This is real adversarial conformance testing,
   but scoped to
  WebSocket only.
- Code-level fuzz harnesses (jazzer / libFuzzer / OSS-Fuzz `FuzzedDataProvider` / `@FuzzTest`):
  NOT found in-repo (grep across `*.kt/*.kts/*.java/*.yml/*.gradle` returned nothing).
- Property-based testing (jqwik,
   kotest property,
   `forAll`/`Arb`):
   NOT found (only
  `System.getProperty` false positives).
- Mutation testing (pitest / `mutationTest`):
   NOT found.

Net:
 strong example-based unit/integration coverage plus WebSocket conformance fuzzing;
 no
property-based,
 mutation,
 or general code-fuzz harness committed to this repo.
 Reported as a gap,
not a disqualifier.

### Security posture signals

`BUG-BOUNTY.md` points to an active Bugcrowd program (Block open source).
 Recent issue triage shows
maintainers reasoning explicitly about security boundaries (CRLF via `addUnsafeNonAscii`,
 gzip-bomb
resource policy,
 WebSocket masking,
 TLS) and rejecting low-quality bulk-scanner reports with cited
RFCs and prior policy threads.

## 3. Maintenance signals

- Reach:
   46,968 stars,
   9,273 forks.
   Foundational in the JVM/Android ecosystem.
- Activity:
   `pushedAt` 2026-06-06 (one day before this report);
   latest commit 2026-06-03.
- Release cadence:
   steady tagged 5.
  x line (5.0.0 -> 5.1.0 -> 5.2.0..5.2.3 -> 5.3.0 -> 5.3.1 ->
  5.3.2).
   CHANGELOG shows 5.3.0 on 2025-10-30,
   5.3.2 on 2025-11-18.
   Releases publish to Maven
  Central with changelog notes (no GitHub Release objects,
   so `gh release list` is empty;
   tags and
  CHANGELOG are the source of truth).
- Maintainer concentration:
   dominated by swankjesse (Jesse Wilson,
   2891 commits),
   yschimke (Yuri
  Schimke,
   810),
   JakeWharton (784);
   renovate[bot] (643) automates dependency bumps.
   Bus factor is
  concentrated on 2-3 people,
   mitigated by Square/Block backing and active automation.
- Issue/PR responsiveness:
   maintainers (yschimke,
   JakeWharton,
   both COLLABORATORs) respond within
  hours to days on recent issues,
   often with RFC citations and policy links.
   Recent merged PRs are a
  mix of renovate dep updates and human commits (e.g. yschimke #9459 2026-05-25).
   Close latency
  sample:
   #9479 same-day,
   #9451 ~12 days with discussion,
   #9440 ~13 days.

State:
 actively released,
 responsive maintainers,
 large but triaged backlog.
 Healthy.

## 4. Alternatives (with concrete rejection reasons)

Note:
 all three are JVM HTTP clients and therefore share OkHttp's fatal mismatch with this TS/Bun
repo.
 Reasons below are the technical reasons one would reject each relative to OkHttp on the JVM.

- Ktor client:
   Kotlin-first,
   coroutine-native,
   multiplatform.
   Rejected vs OkHttp because it is an
  abstraction over engines (one of which is OkHttp/CIO) rather than a transport itself,
   adding the
  kotlinx-coroutines and ktor-client dependency stack and an engine-selection layer;
   for a plain
  JVM HTTP need it is heavier and less direct than OkHttp's two-dependency surface.
- `java.net.http.HttpClient` (JDK built-in):
   zero extra dependencies,
   HTTP/2 native.
   Rejected vs
  OkHttp because it lacks OkHttp's connection-pool ergonomics,
   interceptor pipeline,
   response cache
  (`DiskLruCache`),
   certificate pinning API,
   and Android back-compat;
   it also requires JDK 11+ so it
  cannot serve the JDK 8 targets OkHttp's CI still validates.
- Retrofit:
   not a competing transport at all.
   It is a typed REST adapter that runs on top of OkHttp
  as its HTTP engine,
   so it cannot replace OkHttp;
   choosing Retrofit still pulls OkHttp underneath.

For the actual repo (TypeScript/Bun),
 the relevant HTTP options are the platform `fetch`/`undici`,
which are the correct layer here and make any JVM client moot.

## Quality-check summary

- Open-source default:
   satisfied (Apache-2.0).
- Constraint-fit before stack-fit:
   FAILS for this repo (no JVM runtime consumer).
- Source audited:
   yes (request,
   connection,
   TLS paths cited with line numbers).
- Tests/CI inspected:
   yes;
   broad matrix,
   security-focused suites.
- Fuzz/property/mutation:
   WebSocket Autobahn conformance present;
   no code-fuzz/property/mutation
  harness in-repo (reported).
- Maintenance:
   healthy,
   active,
   concentrated maintainer set.
- Full validation:
   built and ran in bounded container;
   live HTTPS GET -> 200,
   528-byte body.
- Verdict:
   REJECT for this repo on applicability;
   technically sound and would be a strong default on
  the JVM.
