# AGP 9.2.1 host-JVM tests fail when a debug engine calls Android `Log.i`

## Symptom

The debug-only filename baseline compiled,
but `:app:testDebugUnitTest` reported `133 tests completed, 4 failed`.
The failures involved fixture setup,
direct play rejection and engine release.
They occurred before any filename baseline frame was accepted.

The installed mockable Android library emits this diagnostic:

```text
# AGP-generated android.jar, android.util.Log.i
Method i in android.util.Log not mocked. See https://developer.android.com/r/studio-ui/build/not-mocked for details.
```

This was a consumer-side test-boundary mistake,
not a filename-rendering failure or an established AGP defect.

## Root cause

The initial debug `FilenameBaselineEngine` called `android.util.Log.i`
directly from its load,
seek,
pause,
play and release methods.
The real controller tests had not established that newly added Android
framework calls would execute in the host JVM.
That assumption was incorrect.

AGP supplies the local test classpath with a mockable Android library,
not the device framework implementation.
The [Android local-test documentation][local-tests] describes the distinction
and the default exception behavior.

The matching published `builder:9.2.1` source contains
`com/android/builder/testing/MockableJarGenerator.java:217` and `:232`:

```java
// builder-9.2.1-sources.jar: com/android/builder/testing/MockableJarGenerator.java
if (returnDefaultValues || methodNode.name.equals(CLASS_CONSTRUCTOR)) {
    if (INTEGER_LIKE_TYPES.contains(returnType)) {
        instructions.add(new InsnNode(Opcodes.ICONST_0));
```

Its `throwExceptionsList` at `:237` to `:264` constructs a
`RuntimeException` with the method-specific diagnostic and an `ATHROW`:

```java
// builder-9.2.1-sources.jar: com/android/builder/testing/MockableJarGenerator.java
"Method "
        + methodNode.name
        + " in "
        + className
        + " not mocked. See"
        + " https://developer.android.com/r/studio-ui/build/not-mocked"
        + " for details."
```

Read-only comparison with `jrodbx/agp-sources` revision
`1fa1ad1b0753d0a079b9f24fad0187cd95c38772` found the same branches at
`9.1.0/com.android.tools.build/builder/com/android/builder/testing/MockableJarGenerator.java:217`
and `:232`.
That clone has no `9.2.1` directory;
the published matching-version source and installed bytecode,
not the older mirror,
are the deciding evidence.

`javap -c android.util.Log` against the installed transformed `android.jar`
showed `Log.i(String, String)` constructing the named `RuntimeException`
and throwing it.
The transformed jar SHA-256 was
`eb4d94cff205af4417c7ec15991885d6bdb02306a9b7dbd7495593b7279dfbf6`.
The matching source-jar SHA-256 was
`0b5a4d82c0a6cdbbad271f35b0a95c13361f94182b8f5285e15eb86d69236d4b`.

## Verification

The disposable prototype uses AGP `9.2.1`,
Gradle `9.5.1` and Temurin Java `21.0.12+8`.
The source artifact was fetched from [Google Maven][source-jar],
read without editing and compared with the installed transformed jar.
The mirror clone was read-only;
no third-party code was executed or changed.

The failing catalog was the original engine's direct platform logging:

- Fixture setup and paused selection reached `Log.i` while recording engine state.
- Direct play logged before its intended `IllegalStateException`.
- Release logged before the released-engine guard test could proceed.

The working catalog uses an injected event writer:

- Unselected long and short fixtures preserve exact row text and do not load audio.
- Both selected identities restore paused,
  with the intended load and seek diagnostic events.
- Unknown scenes,
  unknown selections,
  real file URIs and released-engine loads fail with their intended errors.
- Direct play emits its diagnostic and throws the intended error.
- Release clears callbacks and emits its diagnostic.

The existing package task is the reproducible host-test entry:

```sh
# Disposable prototype worktree; execute inside its bounded build environment.
/opt/mise --yes run --skip-tools //package/music-player/android-app:test:unit
```

The complete corrected task passed.
The filename baseline report contains `8` tests with zero failures,
errors or skips;
the package execution contains `133` tests.
A removed autoplay guard then produced one fresh,
targeted failure:

```text
# Fresh targeted FilenameBaselineFixtureTest report, not stale full-suite output.
java.lang.AssertionError: Expected exception: java.lang.IllegalStateException
```

Exact guard restoration,
passing complete tests and an APK rebuild followed.
The private verifier initially checked only exception-name presence,
which could accept an unexpected-exception failure or stale output.
It now requires a fresh single-test report,
the exact missing-expected-exception message and `AssertionError` type.
A subsequent verifier correction added JUnit's actual message prefix;
that correction changed no source guard or APK behavior.

## Verified workaround

The debug-only engine now receives a mandatory
`(FilenameBaselineEvent) -> Unit` writer.
An immutable event separates its tag from its message.
The native activity maps each event to `Log.i(event.tag, event.message)`;
host tests store the events in a test-owned collection and assert the
specific engine events.

This changes the diagnostic boundary,
not controller seeding,
paused state or the invoked production renderer.
No logging was removed,
no default no-op writer was added,
and no production source or test configuration was changed.
The tradeoff is that host tests verify event emission,
not Android's log adapter;
native capture must exercise that adapter separately.

## What does not work

- Compiling against Android types does not prove their implementations execute
  in local JVM tests.
- Merely asserting a nonempty event list does not prove engine logging:
  a fixture-entry event alone satisfies it.
- Finding an exception class name anywhere in a report is not mutation proof.
- A current hierarchy can retain text whose visible rendering is ellipsized;
  these host tests do not establish native filename visibility.

Enabling `unitTests.returnDefaultValues` or adding a mocking framework was
not attempted.
The Android documentation cautions that default returns can hide failures.
The existing interface seam made either configuration change unnecessary
for this incident.

## Upstream filing artifact

Nothing is proposed upstream.
The consumer called a device API at a host-test boundary,
then corrected that boundary using existing interfaces.
There is no established upstream defect or additive upstream fix.

### Upstream filing decision

- Fault:
  the matching source,
  installed bytecode and documentation explain the observed behavior;
  the consumer boundary was wrong.
- Fixability:
  our interface-level correction passed;
  no upstream change is needed for this use case.
- Supported use:
  the Android documentation supports local logic tests with controlled
  dependencies,
  not arbitrary device framework execution in the workstation JVM.
- Contribution policy:
  no contribution is proposed,
  and no policy ban is inferred.
  The source mirror is an archive,
  not the AGP issue owner.
- Maintainer intent:
  the documented default and its caution are evidence of supported behavior,
  not evidence that an unrelated proposed change would be accepted or rejected.
- Upstream prototype:
  none was created because no upstream fault was established.
  The verified consumer-side correction is not an upstream patch.

The `.out-of-scope/` filenames were inspected;
none identified this AGP logging incident.
GitHub issue and PR searches for `"android.util.Log" "not mocked"` returned
consumer-library reports and changes.
Those are comparable incidents,
not an identified duplicate AGP defect.
No report,
comment or issue draft was sent.

[local-tests]: https://developer.android.com/training/testing/local-tests
[source-jar]: https://dl.google.com/dl/android/maven2/com/android/tools/build/builder/9.2.1/builder-9.2.1-sources.jar
