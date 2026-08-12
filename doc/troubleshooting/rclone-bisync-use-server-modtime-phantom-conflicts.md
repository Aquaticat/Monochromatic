# rclone bisync with --use-server-modtime records the source mtime in its baseline but compares the S3 LastModified, so every uploaded file reads back as changed and a file edited across two runs loses its name to a false conflict

A file edited locally during two consecutive hourly bisync runs ends up with its original name
deleted on **both** sides,
 replaced by `<name>.conflict1` (the remote's copy) and `<name>.conflict2` (the local copy).
No data is lost,
 but the file the user was working on no longer exists under the name they use,
 and an application that reopens it by path sees nothing.

This is not a deletion,
 not Seafile,
 and not a Garage fault.
It is rclone bisync's documented conflict resolution firing on a conflict that is half phantom.

Observed against the hourly `rclone-bisync-garage.service` user unit described in
[rclone-double-encode-phantom-keys.md](rclone-double-encode-phantom-keys.md),
 which is where `--use-server-modtime` was introduced,
 for the reason recorded there:
 dropping the per-object HEAD.
Six occurrences,
 always on whichever files were being actively edited that session,
 never on the roughly 9900 untouched files in the same tree.
Paths in this document are synthetic;
 the mechanism does not depend on them.

## Symptom

From one run,
 with `-v`:

```text
INFO  : Path1 checking for diffs
INFO  : - Path1    File changed: time (newer) - DIR/file-a.html
INFO  : Path1:    4 changes:    0 new,    4 modified,    0 deleted
INFO  : Path2 checking for diffs
INFO  : - Path2    File changed: size (larger), time (newer) - DIR/file-a.html
INFO  : Path2:    6 changes:    1 new,    5 modified,    0 deleted
INFO  : Applying changes
INFO+2: - WARNING  New or changed in both paths       - DIR/file-a.html
INFO+2: - Path1    Renaming Path1 copy                - garage:.../DIR/file-a.html.conflict1
INFO  : DIR/file-a.html: Copied (server-side copy) to: DIR/file-a.html.conflict1
INFO  : DIR/file-a.html: Deleted
INFO+2: - Path2    Renaming Path2 copy                - /local/.../DIR/file-a.html.conflict2
INFO  : DIR/file-a.html: Moved (server-side) to: DIR/file-a.html.conflict2
```

The asymmetry in those two diff lines is the whole finding.
Path2 changed `size (larger), time (newer)`:
 a real edit.
Path1 changed `time (newer)` with **no size change**:
 the remote bytes are identical to what bisync already had.
Only one side really changed,
 but bisync counted two and took the conflict branch.

## Root cause

### The same remote object reports two different mtimes

`--use-server-modtime` selects the S3 `LastModified` instead of the mtime rclone stores in
object metadata on upload.
For a byte-identical object those disagree:

```bash
rclone lsl garage:.../DIR/                        # metadata mtime (X-Amz-Meta-Mtime)
#     8362 2026-08-11 20:53:46.620927602 file-b.md
rclone lsl garage:.../DIR/ --use-server-modtime   # S3 LastModified
#     8362 2026-08-11 21:01:58.234000000 file-b.md
```

Same size,
 same bytes,
 two timestamps eight minutes apart.
The nanosecond precision of the first identifies it as the stored source mtime;
 `LastModified` is second-granularity and equals the moment rclone uploaded the object.

### bisync's baseline records the mtime it did not compare with

The listing under `~/.cache/rclone/bisync/*.path1.lst`,
 written at 21:02 by the very run that uploaded that object at 21:01:58:

```text
-     8362 - - 2026-08-12T00:53:46.620927602+0000 "DIR/file-b.md"
```

That is the source mtime (20:53:46 local),
 not the `LastModified` (21:01:58) the next run will read.

The precise claim,
 and no broader:
 **for a file bisync has just uploaded,
 it records the source's mtime in the baseline rather than re-reading the destination's
`LastModified`.**
Objects bisync did not upload,
 such as ones it created by server-side copy,
 record `LastModified` in the baseline and match on the next run;
 those show no phantom.
So the defect is specific to the upload path,
 which is why it tracks edited files exactly.

Consequence:
 every file bisync uploads is guaranteed to read back as
`Path1 File changed: time (newer)` on the following run,
 with no content change.

### Why that usually costs nothing, and occasionally costs the filename

A phantom alone is one-sided.
Path1 appears changed,
 Path2 does not,
 so bisync copies remote to local.
The bytes are identical,
 and because `--use-server-modtime` also stamps the downloaded file's local mtime with the
`LastModified`,
 the two sides now agree and the phantom clears itself.
That silent self-heal is why this does not fire on every file every hour.

It becomes destructive only when the local file **also** changes before that heal runs:

1.  Edit the file. Run N uploads it. Remote `LastModified` becomes run N's clock.
2.  Keep editing. The local file changes again, genuinely.
3.  Run N+1 sees Path1 newer (phantom) and Path2 newer and larger (real).
    Both sides changed,
     so bisync applies `--conflict-resolve` (default `none`),
     renames both copies,
     and the original name exists on neither side.

An editing session spanning two consecutive hourly runs meets that condition every time.

## Verification

Versions:
 rclone `v1.75.0` via the mise shim
 (`rclone version`;
 the mise shim resolves to `rclone-v1.75.0-linux-amd64`,
 so this is a later rclone than the `v1.74.3` recorded in the sibling document),
 Garage `dxflrs/garage:v2.3.0`,
 single node,
 bucket `files`.
Tree under sync:
 9948 files,
 77.9 GiB.

### The two clocks disagree on an unchanged object

The two `rclone lsl` invocations above,
 differing only in `--use-server-modtime`,
 against the same object.
Read-only.

### The baseline disagrees with what the next run will read

```bash
grep 'DIR/file-b.md"' ~/.cache/rclone/bisync/*.path1.lst
rclone lsl garage:.../DIR/ --use-server-modtime | grep file-b.md
```

The first prints the source mtime,
 the second the upload time.
Any difference predicts a phantom on the next run.

### Standing prediction, to be confirmed rather than assumed

A byte-identical,
 locally untouched file whose baseline and `LastModified` disagree
**must** be logged as `Path1 File changed: time (newer)` by the next run,
 with no size change,
 and must not conflict.
If a run logs no such line for such a file,
 this analysis is wrong and should be reopened.
This doubles as the positive control:
 the phantom has to be observable on a file nobody edited,
 otherwise the mechanism above is not what is happening.

### The fix reproduced and proved on a throwaway fixture

Run against two local directories under `~/temp/agent`,
 never against the real bucket.
Twenty files,
 so that changing one stays under bisync's "all files were changed" safety abort;
 an earlier single-file fixture tripped that guard and proved nothing.
A genuine conflict is created by changing `f3.txt` on **both** sides,
 with the Path2 copy given the later mtime by `touch -d`:

```text
DEFAULT (current behaviour, no flag)
  files named f3*: f3.txt.conflict1 f3.txt.conflict2
  f3.txt: ABSENT (original name destroyed)

WITH --conflict-resolve newer
  files named f3*: f3.txt f3.txt.conflict1
  f3.txt content: FROM-B-newer
```

The first block reproduces the reported symptom exactly.
The second shows the flag doing the two things that matter:
 the original filename survives and holds the newer bytes,
 and the losing copy is retained rather than deleted.

### The cost that motivated the flag

Listing all 9948 objects,
 warm,
 `--fast-list --checkers 32`:

- with `--use-server-modtime`:
   3.08 s
- without it (per-object HEAD):
   19 min 27 s

Both returned the same object count,
 so the difference is the per-object HEAD and nothing else.
That is a factor of roughly 380.
The flag is not a micro-optimisation,
 and the sibling document's "took minutes" understates it.

This settles the ranking below rather than merely informing it.
The timer fires hourly,
 so a 19-minute listing would spend a third of every hour in a run that currently takes
seconds,
 and `TimeoutStartSec=3000` leaves under 31 minutes of margin before a stalled run is reaped.
Any fix that reintroduces the per-object HEAD pays that on every run,
 forever,
 to correct a comparison that a single flag already resolves correctly.

## Candidate fixes

Ranked for an operator whose priority is never silently losing the newest version of a file
they are actively editing.

Option 1 is now deployed,
 chosen by the operator after the measurement above.
Adding `--conflict-resolve` does **not** require a `--resync`,
 unlike a filter change;
 verified on a throwaway fixture by adding the flag mid-stream between two runs,
 which completed normally with exit 0.

1.  **`--conflict-resolve newer`, on its own.**
    Cheapest correct-in-practice fix,
     keeps the 3.1 s listing.
    Leave `--conflict-loser` at its default,
     which `rclone bisync --help` gives as `num`:
     the winner then keeps the original filename and only the loser is renamed to
     `<name>.conflict1`.
    That is the property that matters here,
     because the reported harm is the filename disappearing,
     not the bytes going missing.
    Pro:
     resolves the false conflict in favour of the genuinely newer local edit,
     preserves the working filename,
     and still keeps the losing copy on disk.
    Con:
     it resolves a conflict that should never have been raised,
     so it is a guard rather than a cure,
     and it leaves a `.conflict1` file behind to be cleaned up.
    Do **not** pair it with `--conflict-loser delete`:
     that buys tidiness by destroying the copy that would be the fallback if `newer` ever
     chooses wrong.
    Ranked above dropping the flag because it costs nothing per run and the phantom cannot
    make the remote win in a single-writer setup:
     the remote's inflated time is the upload of an edit that is already in the local file,
     so a later local edit always carries a later mtime.
    That reasoning depends on there being one writer,
     and would need rechecking before a second machine writes to this bucket.
2.  **Drop `--use-server-modtime`.**
    The only option that removes the phantom at its source rather than resolving it.
    Pro:
     baseline and comparison then use the same clock,
     and no false conflict is ever raised.
    Con:
     reintroduces the per-object HEAD measured above,
     and the sibling document notes the phantom-key filter `- **‛**` became load-bearing
     precisely because `--use-server-modtime` removed the old HEAD-time self-heal;
     that interaction needs rechecking before changing it.
    Ranked below the first because correctness is bought with a per-run cost of minutes,
     and the first option already prevents the observed loss.
3.  **`--conflict-resolve path2`, local always wins.**
    Pro:
     simple,
     and correct for a single-writer setup.
    Con:
     silently discards genuine remote-side changes,
     so it converts a visible mess into an invisible one the moment a second machine writes.
    Ranked below `newer` only because `newer` degrades more gracefully under that same event.
4.  **`--compare size,checksum`.**
    Pro:
     immune to clock semantics entirely.
    Con:
     the run already reports `"SlowHashDetected": true`,
     and Garage multipart ETags are not plain MD5,
     so this needs proving before it is trusted.
    Ranked below the above for being unproven here,
     not for being wrong in principle.
5.  **Leave it and keep restoring from git.**
    Ranked last:
     it works only because the affected files happen to be in a git repository that lives
     outside the synced tree,
     which is a property of one directory and not of the sync.

Rejected outright:
 `--conflict-suffix` changes,
 which only rename the wreckage.

## What this analysis got wrong on the way

`--conflict-resolve newer` was first rejected on the grounds that the phantom would make the
stale remote copy win.
That was wrong,
 and the log disproves it.
The reasoning had used the `LastModified` of the `.conflict1` object,
 21:01:55,
 but that object was created by the server-side copy **during** the run being diagnosed.
What Path1 actually presented at diff time was the original object's upload time from the
previous run,
 20:01:57,
 against a local mtime of 20:52:28.
Local was genuinely newer,
 and `newer` would have chosen correctly.

The general lesson is narrow and worth keeping:
 when reconstructing a conflict,
 the timestamps on the conflict artifacts are stamped by the resolution itself and are not
evidence about the state that triggered it.
Read the previous run's upload line instead.
