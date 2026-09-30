# Android 17 uiautomator null-root dump leaves an earlier XML file available

## Symptom

The Android API 37 disposable Fold capture emitted:

```text
ERROR: null root node returned by UiTestAutomationBridge.
```

The calling Node.js script continued after `uiautomator dump` and read its
fixed `/sdcard/search-filename.xml` destination.
Its title/support check then rejected the frame:

```text
leading title/support multiplicity failed for Track · Cult of Luna / Studio · Play; observed 0, required 1
```

The retained XML was byte-equivalent after trimming to the previous
accepted supporting-line scene.
A fresh-path reprobe contained the expected conditional supporting line.
This incident is separate from the corrected dark-cover scene-routing bug.
Neither establishes a filename-renderer failure or an open keyboard.

## Root cause and boundary

The consumer had ignored the dump's success message and reused one path.
That allowed an earlier XML file to survive a failed hierarchy acquisition
and be read as if it described the current scene.
The multiplicity guard rejected it before a screenshot was accepted.
The underlying reason for the null accessibility root was not isolated.

A read-only comparable AOSP source clone is
`aosp-mirror-neo/platform_frameworks_uiautomator`,
revision `87828477f19061e924919c874408a2c34e9093bc`.
It is not established as the exact source revision of the installed
Google emulator image.
The public AOSP [dump source] contains the same branch and diagnostic.

`cmds/uiautomator/src/com/android/commands/uiautomator/DumpCommand.java:86` to `:91`
gets the active accessibility root and returns when it is absent:

```java
// cmds/uiautomator/src/com/android/commands/uiautomator/DumpCommand.java
UiAutomation uiAutomation = automationWrapper.getUiAutomation();
uiAutomation.waitForIdle(1000, 1000 * 10);
AccessibilityNodeInfo info = uiAutomation.getRootInActiveWindow();
if (info == null) {
    System.err.println("ERROR: null root node returned by UiTestAutomationBridge.");
    return;
}
```

The file-writing call is later,
at `DumpCommand.java:99`:

```java
// cmds/uiautomator/src/com/android/commands/uiautomator/DumpCommand.java
AccessibilityNodeInfoDumper.dumpWindowToFile(info, dumpFile, rotation, size.x, size.y);
```

`cmds/uiautomator/src/com/android/commands/uiautomator/Launcher.java:83` to `:84`
returns after the command's `void` method returns:

```java
// cmds/uiautomator/src/com/android/commands/uiautomator/Launcher.java
command.run(args2);
return;
```

This comparable source explains why a printed acquisition failure is not
necessarily a failing command status.
The observed consumer continuation and retained old XML support the
local failure boundary independently of source-revision equivalence.
The source's readiness comment is not proof of this incident's cause.

## Verification

The device reported API `37` and fingerprint:

```text
google/sdk_gphone16k_x86_64/emu64xa16k:17/CE2A.260420.019/15611780:user/dev-keys
```

The runtime is the owned `Fold_No_Hardware_Probe`,
capped at 6 GiB and 2 CPU.
The original AVD was not used.

The private failed-run evidence is under
`${HOME}/temp/agent/search-filename-presentation-native-private/search-comparison-corrected/`:

- `rejected-null-root-stale.xml` matches the previous accepted XML after trimming.
- `null-root-fresh-reprobe.xml` contains the current conditional supporting line.
- `null-root-rejection-and-reprobe.json` records those comparisons and device identity.

The consumer harness runs with:

```sh
# Private consumer boundary and native reprobe harness
node "${HOME}/temp/agent/verify-fresh-android-hierarchy.ts"
```

Working controls include a fresh successful destination,
a bounded null-root-then-success retry,
and a real native fresh-path dump.
Rejected controls include:

- Null-root diagnostic with zero status and an available stale file.
- A success message naming the wrong destination.
- A nonzero command status.
- An unexpected diagnostic accompanying a success message.
- Incomplete XML at a fresh destination.

The failure controls do not read a destination after a rejected command.
The observed result was:

```text
FRESH_HIERARCHY_POSITIVE_REJECTED_AND_NATIVE_CONTROLS_COMPLETE
```

The controls prove the consumer's rejection/retry behavior,
not reliable acquisition on every Android scene.
The complete comparison recapture remains a separate verification step.

## Verified workaround

`fresh-android-hierarchy.ts` uses a new destination for each attempt,
captures stdout/stderr and status,
requires the exact destination-confirming success line,
and checks complete XML before returning it.
It retries only the observed null-root diagnostic,
with a finite attempt bound;
other errors abort rather than reuse old evidence.

The exact successful native message is:

```text
UI hierchary dumped to: /sdcard/filename-rejection-reprobe.xml
```

The typo belongs to the emitting tool and is preserved in the check.
Accepted capture records retain the fresh destination and command results.
Tradeoffs are additional temporary guest files and retry delay.
Repeated acquisition failure still blocks capture.
This workaround changes evidence acquisition,
not native accessibility behavior,
filename policy or matching.

## What does not work

A fixed destination plus an unchecked successful process return did not
prove a fresh hierarchy.
A title-only guard would also have missed this stale scene,
whose first title was unchanged;
checking the supporting cue caught it.
Increasing screenshot settling time was not tested as a null-root fix.
The later successful reprobe does not establish a timing cause.

## Upstream filing decision

The `.out-of-scope/` filename census had no Android/uiautomator exemption.
Primary-source search found the comparable
[consumer report] with the same diagnostic and no comments.
Cross-repository pull-request search also found consumer retry changes;
those titles are not source evidence for the installed image.
The attempted `aosp-mirror` and `LineageOS` repository names did not exist;
repository search found the read-only comparable clone used here.

1.  Upstream fault is not established:
    the demonstrated bug was our stale-file read.
2.  No upstream fix target is identified;
    null-root causality and installed-source equivalence remain unverified.
3.  The comparable command documents hierarchy dumping,
    not unconditional availability of an active root.
4.  Clone policy-file discovery found only a sample README;
    contribution suitability was not established and no submission is planned.
5.  The consumer report proves comparable symptoms,
    not an upstream acceptance or rejection signal.
6.  No upstream patch was prototyped because no upstream defect was established.
    The consumer correction was tested with allowed/rejected fixtures and a native invocation.

No issue,
comment or patch was sent.
There is no upstream filing artifact to add:
this is a consumer provenance correction,
not a newly diagnosed upstream defect.

[dump source]: https://android.googlesource.com/platform/frameworks/uiautomator/+/refs/heads/master/cmds/uiautomator/src/com/android/commands/uiautomator/DumpCommand.java
[consumer report]: https://github.com/android/testing-samples/issues/283
