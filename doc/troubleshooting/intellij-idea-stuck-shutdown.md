# IntelliJ IDEA 2026.2.1: launching during a stuck shutdown exits 16 without opening a window

## Symptom

IntelliJ IDEA appears not to launch from its Toolbox desktop entry.
The Toolbox launcher path exists and points at the current installation,
but a direct launch prints this message and exits with status 16:

```text
IDE is being shut down
```

The observed machine still had an IntelliJ IDEA process from the prior day.
IDEA had received repeated non-forced shutdown requests,
but the process remained alive and continued to own the single-instance endpoint.
Every new launch therefore contacted that old process instead of creating a new IDE process.

## Root cause

The immediate launch failure was a stuck existing IDEA instance that had entered the shutdown lifecycle.
The evidence does not identify the component that blocked that shutdown.

Source findings use the IntelliJ Community source at tag `idea/262.9437.185`,
commit `b75ab523e6adbe1d26112219729eacbcfd24daa0`,
which is also tagged `idea/2026.2.1`.

### Step 1: a new launcher delegates to an existing instance

`platform/platform-impl/bootstrap/src/com/intellij/platform/ide/bootstrap/DirectoryLock.java:162-168`
documents that `lockOrActivate` first tries to own the endpoint and otherwise contacts the running instance:

```java
/**
 * Tries to grab a port file (thus locking the directories) and start listening for incoming requests.
 * Failing that, attempts to connect via the existing port file to an already running instance.
 */
public @Nullable CliResult lockOrActivate(
  @NotNull Path currentDirectory,
  @NotNull List<String> args
)
```

`DirectoryLock.java:334-359` sends the new invocation to that instance and returns its exit code and message:

```java
LOG.debug("connecting to " + address);
// ...
request.add(currentDirectory.toString());
request.addAll(args);
sendLines(socketChannel, request);
// ...
var exitCode = Integer.parseInt(response.get(0));
var message = response.get(1);
return new CliResult(exitCode, message.isEmpty() ? null : message);
```

The observed old process was responsive enough to return a structured result.
This was not a stale lock file or a refused connection.

### Step 2: shutdown replaces normal activation with a disposing response

`platform/platform-impl/src/com/intellij/openapi/application/impl/ApplicationImpl.java:865-870`
invokes lifecycle listeners after shutdown has begun:

```java
try {
  lifecycleListener.appWillBeClosed(restart);
}
catch (Throwable t) {
  logErrorDuringExit("Failed to invoke lifecycle listeners", t);
}
```

`platform/platform-impl/bootstrap/src/com/intellij/platform/ide/bootstrap/ApplicationLoader.kt:566-570`
replaces the normal external-command handler at that event:

```kotlin
override fun appWillBeClosed(isRestart: Boolean) {
  setActivationListener {
    CompletableDeferred(
      CliResult(AppExitCodes.ACTIVATE_DISPOSING, IdeBundle.message("activation.shutting.down"))
    )
  }
}
```

`platform/core-api/src/com/intellij/idea/AppExitCodes.java:20-23` assigns status 16 to that response:

```java
public static final int ACTIVATE_NOT_INITIALIZED = 14;
public static final int ACTIVATE_ERROR = 15;
public static final int ACTIVATE_DISPOSING = 16;
```

Finally,
`platform/platform-impl/bootstrap/src/com/intellij/platform/ide/bootstrap/startup.kt:574-576`
prints the response and terminates the new launcher:

```kotlin
else {
  result.message?.let { println(it) }
  exitProcess(result.exitCode)
}
```

The complete launch-failure chain was therefore:
the old process retained the single-instance endpoint,
the new process connected to it,
the old process returned `ACTIVATE_DISPOSING`,
and the new process printed `IDE is being shut down` before exiting with status 16.

### What remains unknown

The old log contained repeated JetBrains AI Assistant unload exceptions before the shutdown requests.
Those exceptions are correlated with the incident but do not prove that the plugin blocked shutdown.
A thread dump was not captured before the authorized kill,
so attributing the hang to that plugin or to any later shutdown listener would be speculation.

## Verification

Verified on 2026-08-12 with:

```text
IntelliJ IDEA 2026.2.1
Build #IU-262.9437.185
JDK 25.0.3, JetBrains Runtime
Linux, KDE Plasma Wayland session
```

### Failing catalog before recovery

A direct invocation reproduced the user-visible failure:

```bash
"$HOME/.local/share/JetBrains/Toolbox/apps/intellij-idea/bin/idea"
printf 'exit=%s\n' "$?"
```

```text
IDE is being shut down
exit=16
```

The existing root IDEA process remained alive after repeated shutdown requests.
Repeated launch attempts therefore exercised the same disposing response rather than starting a fresh process.

### Working catalog after recovery

After terminating the stuck IDEA process tree,
the desktop entry launched a new root process:

```bash
gtk-launch jetbrains-idea-e37c368f-a232-4031-8958-0c5d7640c421
```

Verification crossed the window-manager boundary.
A one-shot KWin script matched the new root process ID,
found two IDEA windows,
unminimized them,
and activated each successfully:

```text
count=2
activated=true minimized=false active=true
activated=true minimized=false active=true
```

The IDEA log also recorded two project frames during startup.
A second direct launcher invocation then delegated to the healthy instance and returned normally:

```text
exit=0
External instance command received: count changed from 0 to 1
```

## Verified workarounds

### Terminate the stuck process, then relaunch

First confirm that the running IDEA instance returns `IDE is being shut down` with status 16.
If it remains in that state and the user authorizes possible unsaved-data loss,
terminate that IDEA installation's process tree and relaunch through its desktop entry.

In this incident,
SIGTERM stopped the child processes but not the root IDEA process.
SIGKILL removed the root process,
and the next desktop launch succeeded without deleting settings or caches.

Tradeoff:
forced termination can lose unsaved editor state and interrupt active IDE tasks.
Use it only after confirming that the process is stuck and obtaining authorization.

### Wait for a genuine shutdown to finish

Status 16 is expected while an ordinary shutdown is still progressing.
Waiting avoids data loss when the process is making progress and exits on its own.

Tradeoff:
waiting does not recover an instance that remains alive indefinitely.
Confirm process age and repeat the launcher probe before choosing this path.

## What does not work

- **Repeatedly starting IDEA.**
   Each attempt connects to the same old endpoint and receives status 16.
- **Deleting `.lock` or `.port` while the owner is alive.**
   The old instance was responsive,
  so its endpoint was not stale.
   Removing coordination files can allow competing instances against the same config.
- **Deleting config,
   plugins,
   or caches first.**
   The successful relaunch reused all existing state.
  Destructive state reset was unnecessary.
- **Treating the AI Assistant exceptions as the proven cause.**
   Their timing is suggestive,
  but no pre-kill thread dump links them to the shutdown blocker.

## Upstream filing artifact

### Upstream filing decision

The repository's `.out-of-scope/` entries were checked.
None covers IntelliJ IDEA or JetBrains IDE startup failures.

JetBrains directs reproducible bug reports to YouTrack in
`CONTRIBUTING.md` and welcomes bug-fix contributions with tests.
No policy barring AI-assisted reports was found in `CONTRIBUTING.md`,
`README.md`,
 `.github/`,
 or `.ai/`.
The `.ai/` material describes contributor-agent guidance generation rather than a filing restriction.

The duplicate search covered open and closed GitHub issues and pull requests,
YouTrack searches for the exact message,
`ACTIVATE_DISPOSING`,
Station shutdown,
and broader stuck-process startup failures.
No exact report for a responsive instance returning status 16 was found.
The closest tracker cluster is [IJPL-160882][],
an obsolete umbrella for an existing process that does not respond to activation.
Recent reports such as [IJPL-234004][] were closed as duplicates of that umbrella.
That transport failure differs from this incident,
where the old process accepted the connection and intentionally returned `ACTIVATE_DISPOSING`.

The six filing constraints resolve as follows:

1. **Is it really upstream's fault?**
    Not established.
   IDEA correctly prevented a second instance while shutdown was in progress.
   The component that prevented shutdown completion is unknown and could be an external plugin.
2. **Can upstream fix it?**
    The launcher and shutdown UX are changeable,
   but no specific blocker or safe source-level correction was identified.
3. **Are they supporting this use case?**
    Yes.
   The cited source explicitly implements single-instance activation and shutdown responses.
4. **Would the repo welcome our contribution?**
    Yes for reproducible bug fixes with tests,
   according to `CONTRIBUTING.md`;
    no AI-assistance ban was found.
5. **Will they likely fix it?**
    Not enough evidence.
   IJPL-160882 records concern that a kill button could cause data loss.
   It was closed in favor of cause-specific tickets.
   Since the 2026.2.1 tag,
   the activation-listener file has two unrelated commits and `DirectoryLock.java` has none.
6. **Have we prototyped a minimal fix compatible with their architecture?**
    No.
   Auto-prototyping is not triggered because constraints 1 and 5 do not hold.
   A source patch without a reproducible shutdown blocker would be speculative.

### Nothing additive to file

Do not file or comment from this incident as-is.
IJPL-160882 already records the user-facing stuck-process recovery problem and the data-loss tradeoff of killing it.
This incident adds a distinct status-16 signal,
but lacks the thread dump needed to identify the shutdown blocker or advance a cause-specific ticket.
A bare report that killing the process worked would not add actionable upstream evidence.

[IJPL-160882]: https://youtrack.jetbrains.com/issue/IJPL-160882
[IJPL-234004]: https://youtrack.jetbrains.com/issue/IJPL-234004
