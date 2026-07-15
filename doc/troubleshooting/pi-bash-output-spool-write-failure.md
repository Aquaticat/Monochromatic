# Pi 0.80.6 large Bash output on an exhausted temporary quota loses results or terminates Pi

## Symptom

Pi showed related failures on Linux during July 10,
 2026:

- Three concurrent `bash` tools rendered `No result provided`,
   then Pi surfaced:

  ```text
  [Error: Unknown system error -122: Unknown system error -122, write] {
    errno: -122,
    code: 'Unknown system error -122',
    syscall: 'write'
  }
  ```

- Two later `mise run //packages/git-policy/cli:test:unit` calls remained as an assistant `bash`
  tool call plus an `auto-mode:verdict` entry.
  No matching `toolResult` was appended before Pi was restarted.
- A `gh repo clone` under `/tmp/agent` ended Pi with the same `write` diagnostic.

The batch fixture recursively enumerated and searched `/var/home/user/.pi` and this repository.
Its session-log search can cross Pi's Bash-output spill threshold quickly because a match can
include a long compaction summary.
Concurrency made several spill streams fail together,
but concurrency was not the underlying filesystem error.

## Root cause

### Linux rejected temporary-file writes with `EDQUOT`

Linux defines positive errno `122` as quota exhaustion in
`/usr/include/asm-generic/errno.h:107`:

```c
#define EDQUOT 122 /* Quota exceeded */
```

Node `26.5.0` with libuv `1.52.1` does not include this errno in
`util.getSystemErrorMap()` on this host.
The value therefore renders as `Unknown system error -122`.

The host's `/tmp` is a `tmpfs` with a per-user quota.
`quota --show-mntpoint --human-readable --verbose` measured a hard limit of
`6390M` for `/tmp`.
Immediately after one failure,
`df --human-readable` recorded `6.3G` used while the filesystem still had `9.8G`
globally available.
`df` looked healthy even though this user had reached the write limit.

The user removed the `/tmp` quota later on July 10.
A post-change probe reported `460M` used,
`16G` available,
and `0K` in both quota and limit columns.
These current values do not replace the incident-time measurement.

### Pi spills complete truncated Bash output below `os.tmpdir()`

In `earendil-works/pi` tag `v0.80.6`,
`packages/coding-agent/src/core/tools/output-accumulator.ts:19-22`
selects `os.tmpdir()` for every overflow file:

```ts
function defaultTempFilePath(prefix: string): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `${prefix}-${id}.log`);
}
```

`packages/coding-agent/src/core/tools/output-accumulator.ts:71-75` writes each
chunk after output exceeds its byte or line bound:

```ts
if (this.tempFileStream || this.shouldUseTempFile()) {
  this.ensureTempFile();
  this.tempFileStream?.write(data);
}
```

Lines `211-220` opened the stream and wrote buffered chunks:

```ts
this.tempFilePath = defaultTempFilePath(this.tempFilePrefix);
this.tempFileStream = createWriteStream(this.tempFilePath);
for (const chunk of this.rawChunks) {
  this.tempFileStream.write(chunk);
}
```

A Node `WriteStream` reports open and write failures asynchronously through its
`error` event.
Version `0.80.6` did not install a listener when it created the stream.
Its only listener was attached later at lines `121-142`,
when command execution had ended:

```ts
stream.once("error", onError);
stream.once("finish", onFinish);
stream.end();
```

If `EDQUOT` arrived while the command was producing data,
Node treated the error as uncaught and terminated Pi.
If it arrived during finalization,
the Bash promise rejected before its result was recorded.
A concurrent batch then showed missing results for every call.

Direct `!` Bash and RPC had a second copy of the problem.
`packages/coding-agent/src/core/bash-executor.ts:67-72` created the stream,
lines `88-91` wrote without an error listener,
and lines `118-120` called `end()` without awaiting `finish` or `error`.

### Why the unit suite appeared to hang

The missing unit-suite results followed the measured quota failure and preceded any
session command that removed the remaining `/tmp` occupants.
The suite also creates temporary filesystem fixtures.
The sessions prove that Pi never appended either result,
but do not preserve a child-process stack.
Quota exhaustion is the supported cause for this incident cluster,
not proof of the exact child-test wait site.

### Earlier hypotheses were wrong

The controlled `SIGABRT` core is not evidence of an organic V8 failure.
The signal was intentional and its V8 string stack only identifies where it interrupted Node.
There were no cores for the unprompted incidents.

Pi's post-exit pipe-idle timer did not reproduce the loss.
The exact unit command completed in twenty direct `createBashTool` executions.
A monitored TUI fork and a passive TUI fork both completed it.
Those tests ran after `/tmp` usage had fallen to `447M`.

Compaction was not active at the first missing result.
The preceding assistant call reported `97,965` tokens against a `372,000` token window,
and no compaction entry appeared at that boundary.

## Verification

### Version and source

```text
repository: https://github.com/earendil-works/pi.git
tag: v0.80.6
commit: 2b3fda9921b5590f285165287bd442a25817f17b
Node: v26.5.0
libuv: 1.52.1
```

The verified prototype is preserved in commits `d0c388a16`,
`92f8d209c`,
and `91ac69a42`.
The user later requested removal of both the applied dependency patch and the retained source patch.
The workspace therefore runs unpatched Pi `0.80.6`.

### Reproduction harness

`/var/home/user/temp/agent/pi-output-write-failure-repro.mjs` forces an asynchronous
overflow-stream failure without filling the filesystem.
It points `TMPDIR` to a regular file,
then starts three Bash tools and three direct executors that each emit `60,000` bytes.
Run it against the installed package:

```bash
PI_PACKAGE_ROOT="$PWD/packages/pi-shared/model-selection/node_modules/\
@earendil-works/pi-coding-agent" \
  node /var/home/user/temp/agent/pi-output-write-failure-repro.mjs
```

The unpatched `0.80.6` process exited `1` before writing stdout:

```text
[Error: ENOTDIR: not a directory, open '.../pi-bash-f0d8f46adb772130.log'] {
  errno: -20,
  code: 'ENOTDIR',
  syscall: 'open'
}
```

The temporary patched prototype exited `0`.
All three tool results retained `51,412` text bytes and `fullOutputError`.
All three direct results retained `51,382` text bytes and a persistence warning.
`ENOTDIR` differs from the incident's `EDQUOT`,
but exercises the same asynchronous `WriteStream` error boundary.

The upstream prototype passed:

```text
Test Files  2 passed (2)
Tests       78 passed (78)
Type check  passed
Build       passed
```

A fresh Pi TUI was launched with the invalid temp base and extensions disabled.
Direct user Bash stayed alive and rendered:

```text
Output truncated. Full output unavailable: ENOTDIR: not a directory, open
'.../pi-bash-b9633efb889ace08.log'
```

After the user removed the quota,
the original three concurrent commands completed through the installed package in `1,241 ms`.
The first returned `37,684` text bytes without truncation.
The others returned `51,169` and `44,267` text bytes with valid `/tmp/pi-bash-*.log` paths.
None reported `fullOutputError`.
This confirms that the original workload and spill mechanism work when the resource limit is absent.

### Working and failing catalog

Unpatched `0.80.6` works when output remains below the truncation threshold,
when overflow persistence succeeds,
and when the exact cli-git unit command runs below the `/tmp` quota.

The removed prototype worked for three concurrent overflowing agent tools,
three concurrent direct executors,
interactive `!` Bash with an invalid spill path,
and existing successful-spill behavior.

Unpatched `0.80.6` fails when an overflow stream emits `error` before
`closeTempFile()` attaches its listener.
A finalization error can reject a tool before result recording,
concurrent errors can suppress the whole batch,
and direct Bash uses a second unguarded stream implementation.

## Verified workarounds

### Start Pi with a writable disk-backed `TMPDIR`

```bash
mkdir --parents "$HOME/temp/agent/pi-runtime-tmp"
TMPDIR="$HOME/temp/agent/pi-runtime-tmp" pi
```

This avoids the `tmpfs` user quota and redirects extension temporary files.
The tradeoff is persistence:
 files survive until explicitly cleaned,
and every launcher must inherit the variable.
The directory must exist and be writable before Pi starts.

### Bound searches over session logs

Use file filters,
match limits,
or a disk-backed output file when searching `~/.pi/agent/sessions`.
The tradeoff is that a bound search can omit matches and must be widened deliberately.

### Run unpatched after removing the quota

The user removed the per-user `/tmp` quota and requested removal of every local Pi patch artifact.
The original concurrent workload then completed with successful overflow persistence.
The tradeoff is that unpatched Pi can still lose results or terminate if another spill-file write fails.

## What does not work

- `df` alone reports global `tmpfs` capacity,
  not the user's `6390M` quota.
- Restarting Pi does not free unrelated `/tmp` occupants.
- The controlled V8 core records an intentional `SIGABRT`,
  not the spontaneous failure.
- Changing child-process exit grace does not address a `WriteStream` quota error.
- An invalid `TMPDIR` is suitable only for isolated `pi -ne` reproduction.
  With extensions,
  `@aliou/pi-processes` also fails during startup because it creates a temp directory.
- Repeating the same synchronous command after result loss destroys diagnostic context.
  Follow `NXR` in `AGENTS.md` instead.

## Removed prototype

The retired prototype installed a durable stream error listener,
preserved the bounded tail,
settled finalization without rethrowing persistence errors,
and rendered `Full output unavailable` in context and the TUI.
It is historical evidence only and is not present in the active workspace.

The historical implementation checkpoints are:

- `d0c388a16`,
   which guarded `OutputAccumulator` and ordinary Bash.
- `92f8d209c`,
   which replaced the direct executor's duplicate spooler.
- `91ac69a42`,
   which carried the error through direct Bash and the TUI.

## Upstream filing decision

No `.out-of-scope/` entry covers Pi Bash-output persistence or temporary quotas.

The duplicate search covered open and closed issues and pull requests for
`OutputAccumulator`,
`Unknown system error`,
Bash full-output temp files,
and Bash output errors.
Closed issue [earendil-works/pi#5667][issue-5667] reports the same unguarded spill stream
with `EACCES` on macOS.
Its complete comment thread was reviewed.
The maintainer declined a temp-directory fallback for an old macOS problem.
The Linux `EDQUOT` evidence and generic error-preservation fix are additive,
but no comment was posted.

The six filing constraints resolve as follows:

1.  **Upstream fault:
     yes.
    ** Resource exhaustion is environmental,
    but an unhandled stream error terminating Pi is an upstream robustness bug.
2.  **Upstream can fix it:
     yes.
    ** A persistent listener plus guarded finalization handles
    creation and write failures without changing successful output.
3.  **Supported use case:
     yes.
    ** Pi documents Bash truncation and tests byte and line overflow.
4.  **Contribution welcomed:
     not for an agent-authored filing as-is.
    **
    `CONTRIBUTING.md` requires the contributor's own voice,
    permits clearly labeled AI assistance,
    and the authenticated account is absent from `.github/APPROVED_CONTRIBUTORS`.
5.  **Likely accepted:
     uncertain.
    ** The maintainer rejected a fallback,
    but this patch preserves results rather than selecting another directory.
6.  **Concrete evidence:
     yes.
    ** The failure is reproducible before the patch,
    absent after it,
    and covered by concurrent source tests plus a TUI boundary run.

Constraints four and five do not justify unsolicited agent-authored contact.
The preferred upstream shape is a human-authored,
AI-labeled additive comment on issue `#5667`,
not a duplicate issue.

### Additive comment draft

Do not post this text verbatim as an agent-authored comment.
A human contributor should rewrite it in their own voice and retain the AI-assistance label.

```md
I hit the same unhandled `WriteStream` error on Linux Pi 0.80.6,
but the filesystem error was `EDQUOT` (`errno -122`) rather than macOS `EACCES`.
`/tmp` had global free space while my per-user tmpfs quota was exhausted.

Three concurrent Bash calls crossed the truncation threshold,
then every call showed `No result provided` and Pi terminated on the spill-file `write` error.
I reproduced the same boundary deterministically by pointing `TMPDIR` at a regular file
and emitting 60,000 bytes from each call.

A generic fix does not need a fallback directory:
install an `error` listener when `OutputAccumulator` creates the stream,
record the persistence failure,
stop writing to that stream,
and return the retained in-memory tail with a
`Full output unavailable` warning.
The direct `bash-executor.ts` path needs the same treatment or can reuse `OutputAccumulator`.

The prototype returns all three concurrent tool results,
preserves ordinary successful-spill behavior,
and passes the coding-agent tests,
type check,
and build.
This comment was drafted with AI assistance and revised by me.
```

[issue-5667]: https://github.com/earendil-works/pi/issues/5667
