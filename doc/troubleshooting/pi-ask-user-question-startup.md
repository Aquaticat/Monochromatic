# Pi ask-user-question 0.0.1 detached startup can lose launch inputs

## Symptom and incident boundary

[Issue #581][issue] reports intermittent file-not-found failures in the detached answer terminal.
The reporter cannot reproduce them on demand.
On 2026-10-04,
the reporter supplied this additional diagnostic:

```text
Requested executable not found. Please verify the command is on
the PATH and try again.
```

This exact string is present in the installed Ghostty 1.3.1 binary.
Ghostty tag `v1.3.1`,
commit `332b2aefc6e72d363aa93ab6ecfc86eeeeb5ed28`,
emits it after its command-execution call returns `error.FileNotFound`:

```zig
// Ghostty src/Command.zig:228, 237 to 240 at v1.3.1.
const err = posix.execvpeZ(self.path, argsZ, envp);
// Selected error branch:
error.FileNotFound => stderr.print(
    \\Requested executable not found. Please verify the command is on
    \\the PATH and try again.
```

This identifies the emitting tool and failed operation,
not the missing pathname in every historical occurrence.
The message alone does not establish a PATH configuration problem.

Local Pi logs contain requests removed about 30 seconds after launch,
including calls on 2026-09-28,
2026-09-29,
and 2026-10-01.
Those agree with the startup deadline but do not identify why the helper failed to connect.
The reproduced cases in this document remain separate from those historical incidents.

## Reproduced causes and changes

### Installed runtime disappears while requester remains alive

The old requester passed `process.execPath` directly to the detached terminal.
A disposable consumer copies Node,
starts that copy,
unlinks it,
and invokes the actual built requester.
Before the fix,
its helper launch fails with `spawn <fixture>/node ENOENT`.

On Linux,
`package/pi-plugin/ask-user-question/src/helper-launch.ts:94`
now selects the executable retained by the live requester:

```ts
// package/pi-plugin/ask-user-question/src/helper-launch.ts
const liveExecutable = `/proc/${String(pid,)}/exe`;
await access(liveExecutable, constants.X_OK);
return liveExecutable;
```

When procfs is inaccessible,
or on another platform,
the original runtime path is checked before launch.
Missing runtime access raises `AnswerLaunchError` in Pi with a restart or file-access remediation.
The procfs protection is Linux-specific;
the fallback check cannot prevent a later unlink on another platform.
No alternate executable is selected from PATH.

### Installed helper disappears after terminal launch is prepared

A separate disposable consumer removes its copied installed helper immediately before executing the prepared command.
Before the fix,
Node reports `MODULE_NOT_FOUND` for `answer-helper.mjs`.
This demonstrates dependence on a mutable installation path,
not that a particular historical build deleted that path.

`package/pi-plugin/ask-user-question/src/helper-launch.ts:160`
copies the self-contained helper into the private request workspace before terminal launch:

```ts
// package/pi-plugin/ask-user-question/src/helper-launch.ts
const helperPath = join(workspace.directory, 'answer-helper.mjs');
await copyFile(sourcePath, helperPath, constants.COPYFILE_EXCL);
await chmod(helperPath, PRIVATE_FILE_MODE);
```

The helper has mode `0600` inside the existing private request directory.
The regression verifies its location and mode,
executes the real copied helper and scripted editor,
and checks the returned multiline answer.
A missing source bundle fails in Pi before the terminal opens.

`package/pi-plugin/ask-user-question/src/request-external-answer.ts:211`
prepares that snapshot,
and the launch uses `runtimePath` and the request-owned `helperPath`:

```ts
// package/pi-plugin/ask-user-question/src/request-external-answer.ts:240
command: [
  runtimePath,
  helperPath,
  '--request',
  workspace.requestPath,
],
```

The helper snapshot executes outside the fixture installation's dependency tree.
The built helper's observed imports are Node built-ins only.
This matters because copying a bundle with external package imports would not be sufficient.

### Requester exits before detached startup finishes

The initial real-terminal verifier exited with Node status `13`:

```text
Warning: Detected unsettled top-level await
```

The terminal subsequently attempted to execute a procfs path whose owning process no longer existed.
A regression consumer whose launcher returns at process spawn,
then unreferences its child,
reproduced the requester exit independently of Ghostty.
Depending on scheduling,
the child encountered an unavailable executable or `ECONNREFUSED` after the requester exited.

The previous `server.unref()` immediately after listening was removed from
`package/pi-plugin/ask-user-question/src/answer-channel.ts`.
The listener remains referenced until authentication,
deadline,
or disposal.
This keeps an otherwise idle requester alive during the startup it is awaiting.

### Startup timeout looked like user cancellation

The previous channel deadline surfaced as `The operation was aborted`.
`package/pi-plugin/ask-user-question/src/answer-channel-auth.ts:175`
now translates only a failure caused by its own deadline:

```ts
// package/pi-plugin/ask-user-question/src/answer-channel-auth.ts
if (deadlineSignal.aborted && (startupSignal.reason === deadlineSignal.reason)
  && ((error === deadlineSignal.reason) || (Error.isError(error) && (error.cause === deadlineSignal.reason))))
  throw new AnswerHelperStartupTimeoutError(error);
```

Caller aborts retain their cancellation error.
Protocol failures are not relabeled merely because the deadline also fired.
The startup diagnostic states the elapsed deadline and asks for the detached-terminal error,
without asserting an unobserved cause.

## Verification

Environment:
Node `26.10.0`,
Pi `1.0.2`,
Ghostty `1.3.1`,
Linux.

Regression commit `afd470f3f` failed on both missing launch dependencies while its normal positive control passed.
Commit `04467c4d9` added the detached-start positive-lifetime regression;
it failed with requester status `13` before `c443026a6` retained the listener reference.
The tests operate on copied artifacts and a disposable runtime,
not the installed runtime or package output.

```sh
# Repository root.
mise run //package/pi-plugin/ask-user-question:build
mise run //package/pi-plugin/ask-user-question:test:unit
mise run //package/pi-plugin/ask-user-question:lint:types
mise run //package/pi-plugin/ask-user-question:lint:oxlint
mise run //package/pi-plugin/ask-user-question:verify:extension
mise run //package/pi-plugin/ask-user-question:verify:terminal
```

The terminal task opens the configured default terminal with a scripted editor.
It checks multiline submission and empty-answer cancellation without keyboard injection or changing editor settings.
It must return actual answers;
terminal process startup alone is not a pass.

### Working cases

- Normal helper execution and exact multiline return.
- Installed helper removed after preparation.
- Copied running Node executable unlinked on Linux.
- Launcher returns at spawn without retaining the child.
- Original runtime fallback when procfs is unavailable.
- Caller abort remains cancellation rather than startup timeout.

### Deliberate failure cases

- Missing helper before preparation raises `AnswerLaunchError` without opening a terminal.
- Missing original runtime without procfs raises `AnswerLaunchError` with its underlying `ENOENT`.
- Helper never connects:
  startup wait raises `AnswerHelperStartupTimeoutError` at the real 30-second deadline.
- Historical intermittent terminal failures remain unclassified until their failing launch path is captured.

## Verified workarounds and limits

The Linux live-executable path and request-owned helper snapshot are covered by actual child-process regressions.
They retain the current interpreter rather than silently changing Node versions.
Their tradeoff is dependence on the requester remaining alive;
forcefully terminating Pi is still cancellation,
not a supported way to leave an answer editor running.

The snapshot is deleted with the request workspace.
A terminal that starts only after cancellation or the startup deadline can still find an expired request missing.
This is not protected by copying the helper.
Do not infer that the historical incident was fixed merely because these launch-dependency tests pass.

## What does not work

- Treating every generic abort in Pi's session history as a user cancellation.
- Assuming the current package build task pre-cleans the output directory.
  The current task invokes Rolldown directly;
  the old shared-config comment about task-owned pre-cleaning is not evidence that it happens.
- Adding an artificial keepalive timer only to the verification harness.
  The requester itself must retain the lifetime of the startup it awaits.
- Changing editor-command validation to hide a faulty verification argument.
  The first cancellation verifier passed an empty argument,
  which correctly triggered `Answer helper request editorCommand must be a nonempty string array.`
  Both reporter-provided screenshots from 2026-10-04 10:12 and 10:13 show that same verifier failure.
  The verifier now JSON-encodes its answer argument so even the empty answer has a nonempty command token.
- Publishing the supplied desktop screenshots unchanged.
  They contain unrelated background content through terminal transparency;
  only their diagnostic text is recorded here.

Moving the helper does not change the logger's search root.
`package/module/logger/src/sink/file.ts:174` starts from the working directory:

```ts
// package/module/logger/src/sink/file.ts
const nodeModulesDir = await findNodeModulesUp({
  cwd: process.cwd(),
  stat,
  dirname,
  join,
});
```

A helper failing before logger initialization may still leave only terminal output.
Missing log entries are therefore not proof that a helper ran successfully.

## Upstream filing decision

No external filing is proposed.
The existing repository issue is [#581][issue].
Ghostty's diagnostic correctly reports an execution failure in the reproduced case.

1.  Upstream fault:
    not established;
    reproduced defects are in the first-party launch lifetime and dependency handling.
2.  Upstream fixability:
    no upstream change is needed for the demonstrated first-party fixes.
3.  Supported use case:
    the verification exercises Ghostty's ordinary command launch,
    not an unsupported extension protocol.
4.  Contribution policy:
    not evaluated because no upstream contribution is proposed.
5.  Likelihood of upstream action:
    not evaluated;
    no upstream defect has been established.
6.  Compatible prototype:
    first-party fixes and regressions are committed;
    no Ghostty patch was made.

## Final verification and tracking

On 2026-10-04,
all package verification commands in the Verification section passed.
Oxlint reported `Found 0 warnings and 0 errors.`
The regression output included every startup scenario,
including `detached-start`,
and both deadline and caller-abort cases.
The real Ghostty task returned:

```text
Detached terminal verified: answered
Detached terminal verified: cancelled
```

The extension verifier confirmed sequential registration,
shutdown cleanup registration,
and the helper artifact.
Markdown was rendered with installed Marked `18.0.11` and inspected.
Independent review found no remaining correctness blocker in the reproduced launch paths.

The built output is intentionally ignored by `.gitignore:53` (`dist/`),
not tracked;
source commits were auto-pushed and local artifacts rebuilt.
The source fixes are `1db6774ac`,
`744e1d128`,
`d0808a498`,
and `c443026a6`;
subsequent fixture and documentation commits complete their verification.

Keep #581 open until the intermittent reported incident is matched or verified resolved in normal use.
No historical timeout was retroactively attributed to a particular missing file.
Use a fresh Pi process to exercise the rebuilt extension rather than an already loaded bundle.

[issue]: https://github.com/Aquaticat/Monochromatic/issues/581
