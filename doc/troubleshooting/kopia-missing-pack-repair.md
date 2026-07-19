# Kopia 0.23.1 snapshot auto-maintenance fails rewriting short packs after pack blobs disappear

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

This note records the 2026-06-18 repair of the local Kopia repository at
`/mnt/pcloud/rclone`,
 exposed through the `pCloud.fs` FUSE mount.
Historical snapshots were explicitly disposable for this repair.

## Symptom

`kopia snapshot create --all` created snapshots,
 then failed after snapshotting
when automatic maintenance ran:

```text
running auto-maintenance: error running maintenance: error rewriting contents in short packs: failed to rewrite 24 contents
```

The confusing part was this earlier line:

```text
Finished full maintenance.
```

That line is not a success marker.
 It is always printed when the maintenance
function exits,
 including error exits.
 The actual command result is the final
`running auto-maintenance` error.

The content log for the failing session showed the direct read failures:

```text
unable to rewrite content "1315f73cee": unable to get content data and info: error getting cached content from blob "pefc57c24f9bae94c82c897b92c6c23b8-se22db7c102705cab141": failed to get blob with ID pefc57c24f9bae94c82c897b92c6c23b8-se22db7c102705cab141: BLOB not found
unable to rewrite content "0dd07d1ca7": unable to get content data and info: error getting cached content from blob "pb3d7919a608322d60aaf1b9ca81719da-sb370b158a3c87cd7141": failed to get blob with ID pb3d7919a608322d60aaf1b9ca81719da-sb370b158a3c87cd7141: BLOB not found
```

A full content verify found broader repository damage than the rewrite pass
happened to encounter:

```text
verifyCounters: {"verifiedContents":350650,"totalErrorCount":223,"contentsInMissingPacks":223,"contentsInTruncatedPacks":0,"unreadableContents":0,"readContents":0,"missingPacks":6,"truncatedPacks":0,"corruptedPacks":0}
verify contents: encountered 223 errors: the repository is corrupted, it is missing pack blobs with index-referenced content
```

The missing pack blobs and affected content counts were:

```text
p1e47115fc73a1c76471d14b36cdcdce4-sb370b158a3c87cd7141 31
p7ce57e23f040b71ea83c54ad5e22f208-sb370b158a3c87cd7141 31
p8f97a38dd43c610950981e384eb9c99d-sb370b158a3c87cd7141 28
pb3d7919a608322d60aaf1b9ca81719da-sb370b158a3c87cd7141 23
pdee96303b308ab887056ce9cfd0f1935-sb370b158a3c87cd7141 109
pefc57c24f9bae94c82c897b92c6c23b8-se22db7c102705cab141 1
```

## Root cause

The immediate cause was repository indexes pointing to pack blobs that the
storage backend no longer exposed.
 The investigation did not prove why those
pack blobs disappeared.
 Current evidence is consistent with storage or FUSE
visibility corruption,
 because `kopia repository status` reported filesystem
storage at `/mnt/pcloud/rclone`,
 and `findmnt` reported the backing mount as
`pCloud.fs fuse`.

The Kopia source trace below explains why a successful snapshot ended with a
maintenance error.

`cli/app.go:523` to `cli/app.go:527` runs auto-maintenance only after the main
command action succeeds,
 then wraps maintenance failure as `running auto-maintenance`:

```go
err = act(ctx, rep)

if rep != nil && err == nil && mode.allowMaintenance {
	if merr := c.maybeRunMaintenance(ctx, rep); merr != nil {
		err = errors.Wrap(merr, "running auto-maintenance") // surface auto-maintenance error
	}
}
```

`repo/maintenance/maintenance_run.go:219` to `repo/maintenance/maintenance_run.go:220`
prints `Finished full maintenance.` via a deferred log call,
 so the line prints
on both success and failure exits:

```go
userLog(ctx).Infof("Running %v maintenance...", runParams.Mode)
defer userLog(ctx).Infof("Finished %v maintenance.", runParams.Mode)
```

`repo/maintenance/maintenance_run.go:509` to `repo/maintenance/maintenance_run.go:513`
shows the full-maintenance short-pack rewrite path and the error wrapper:

```go
if shouldFullRewriteContents(s, safety) {
	// find packs that are less than 80% full and rewrite contents in them into
	// new consolidated packs, orphaning old packs in the process.
	if err := runTaskRewriteContentsFull(ctx, runParams, s, safety); err != nil {
		return errors.Wrap(err, "error rewriting contents in short packs")
	}
}
```

`repo/maintenance/content_rewrite.go:58` to `repo/maintenance/content_rewrite.go:61`
prints the user-visible rewrite phase name:

```go
if opt.ShortPacks {
	contentlog.Log(ctx, log, "Rewriting contents from short packs...")
} else {
	contentlog.Log(ctx, log, "Rewriting contents...")
}
```

`repo/maintenance/content_rewrite.go:115` to `repo/maintenance/content_rewrite.go:130`
counts any failed rewrite as a failed content unless the advanced ignore
environment variable is set and the content is already deleted:

```go
if err := rep.ContentManager().RewriteContent(ctx, c.ContentID); err != nil {
	// provide option to ignore failures when rewriting deleted contents during maintenance
	// this is for advanced use only
	if os.Getenv("KOPIA_IGNORE_MAINTENANCE_REWRITE_ERROR") != "" && c.Deleted {
		contentlog.Log2(ctx, log,
			"IGNORED: unable to rewrite deleted content",
			contentparam.ContentID("contentID", c.ContentID),
			logparam.Error("error", err))
	} else {
		contentlog.Log2(ctx, log,
			"unable to rewrite content",
			contentparam.ContentID("contentID", c.ContentID),
			logparam.Error("error", err))

		failedCount.Add(1)
	}
}
```

`repo/maintenance/content_rewrite.go:158` to `repo/maintenance/content_rewrite.go:163`
returns the final `failed to rewrite N contents` error when any rewrite failed:

```go
if failedCount.Load() == 0 {
	if err := rep.ContentManager().Flush(ctx); err != nil {
		return nil, errors.Wrap(err, "error flushing repo")
	}

	return result, nil
}

return nil, errors.Errorf("failed to rewrite %v contents", failedCount.Load())
```

## Verification

Version and source under test:

```text
kopia 0.23.1 build 72ec08fd8edb86c67ed27099bf1b955e1f308ffa from kopia/kopia
source clone: /tmp/agent/kopia-v0.23.1-20260618 at commit 72ec08fd8edb86c67ed27099bf1b955e1f308ffa
```

Failing catalog before repair:

```text
kopia --no-auto-maintenance --no-progress content verify
```

Result:

```text
verifiedContents: 350650
totalErrorCount: 223
contentsInMissingPacks: 223
missingPacks: 6
exit status: 1
```

A targeted check confirmed that one of the rewrite-failed contents depended on
a missing pack:

```text
kopia --no-auto-maintenance --no-progress content verify --prefix=1315f73cee --full --download-percent=100
content 1315f73ceef67426aacb3a00c110ba64 depends on missing blob pefc57c24f9bae94c82c897b92c6c23b8-se22db7c102705cab141
missingPacks: 1
exit status: 1
```

Clean catalog after deleting historical snapshots and running forced maintenance:

```text
kopia --no-auto-maintenance --no-progress content verify
```

Result:

```text
Listed 384 blobs.
verifiedContents: 13
totalErrorCount: 0
missingPacks: 0
truncatedPacks: 0
corruptedPacks: 0
exit status: 0
```

Clean catalog after fresh snapshots:

```text
kopia --no-auto-maintenance --no-progress content verify
```

Result:

```text
Listed 7148 blobs.
verifiedContents: 336684
totalErrorCount: 0
missingPacks: 0
truncatedPacks: 0
corruptedPacks: 0
exit status: 0
```

Snapshot verification also succeeded:

```text
kopia --no-auto-maintenance --no-progress snapshot verify
Finished processing 147947 objects (894.2 GB). Read 0 files (0 B).
exit status: 0
```

The original maintenance path succeeded after repair without
`KOPIA_IGNORE_MAINTENANCE_REWRITE_ERROR` and without `--safety=none`:

```text
kopia --no-auto-maintenance --no-progress maintenance run --full
GC found 0 unused contents (0 B)
GC found 105 unused contents that are too recent to delete (1.2 MB)
GC found 336565 in-use contents (867.1 GB)
GC found 14 in-use system-contents (51.3 KB)
Finished full maintenance.
exit status: 0
```

## Verified workarounds

### Discard old snapshots and repopulate the repository

This was the repair used when old snapshots were not needed.

First record sources:

```bash
kopia --no-auto-maintenance --no-progress snapshot list --all --json > /tmp/agent/kopia-snapshot-list-before-repair.json
```

The recorded sources were:

```text
/home/user/.local/share/Trash
/home/user/Downloads
/home/user/Monochromatic
/home/user/Seafile/Plain
/var/home/user/.var/app/org.telegram.desktop/data/TelegramDesktop/tdata/temp_data
/var/mnt/encrypted/Archive
/var/mnt/encrypted/low
```

Delete every old snapshot for those sources:

```bash
while IFS= read -r path; do
  source="user@bazzite:${path}"
  kopia --no-auto-maintenance --no-progress snapshot delete \
    --all-snapshots-for-source \
    --delete \
    "$source"
done < /tmp/agent/kopia-sources-before-repair.txt
```

Run one purge maintenance pass.
 The environment variable was included as a
belt-and-suspenders guard for already-deleted content rewrite failures,
 and
`--safety=none` was acceptable here because the local repair session was the
only writer and previous snapshots were disposable:

```bash
env KOPIA_IGNORE_MAINTENANCE_REWRITE_ERROR=1 \
  kopia --no-auto-maintenance --no-progress maintenance run --full --safety=none
```

Verify the purge removed missing-pack references:

```bash
kopia --no-auto-maintenance --no-progress content verify
```

Recreate fresh snapshots from recorded sources,
 forcing file hashing so Kopia
repopulates content instead of trusting stale cache state:

```bash
readarray -t sources < /tmp/agent/kopia-sources-before-repair.txt
kopia --no-auto-maintenance --no-progress snapshot create --force-hash=100 "${sources[@]}"
```

Tradeoffs:

- All previous snapshots are intentionally lost.
- Upload work can be large.
   This repair produced fresh snapshots covering
  894.2 GB of snapshot-visible objects and 867.1 GB of in-use content.
- `--safety=none` must not be used when any other Kopia client can write to the
  same repository or when the backend may still be out of sync.

### Run with auto-maintenance disabled during investigation

When snapshots must continue before repair,
 this command avoids re-triggering
the failing maintenance path:

```bash
kopia --no-auto-maintenance snapshot create --all
```

Tradeoff:
 this does not repair corruption.
 It only keeps snapshot creation from
being converted into a failing auto-maintenance command.

## What does not work

- Rerunning `kopia snapshot create --all` with auto-maintenance enabled does not
  fix the missing pack references.
   It creates snapshots,
   then re-enters the same
  maintenance path.
- `kopia content verify --prefix=<id>` is diagnostic only.
   It confirms a content
  ID depends on a missing pack,
   but it does not remove or restore that pack.
- Checking the FUSE mount with `find /mnt/pcloud/rclone ...` is diagnostic only.
  It showed that the six pack filenames were not visible through the mount,
   but
  it does not prove whether pCloud still had recoverable trash or history copies.
- Low-level `content delete` or `index optimize --drop-contents` was not used in
  this repair.
   Those commands can make data loss permanent and were unnecessary
  because all historical snapshots were disposable.

## Upstream filing artifact

### Upstream filing decision

`.out-of-scope/` was checked before considering upstream filing.
 No Kopia-specific
exemption was present.

Duplicate search found related upstream reports:

- [kopia/kopia#3563](https://github.com/kopia/kopia/issues/3563) covers
  maintenance failing with `error rewriting contents in short packs` and a
  maintainer note that deleted-content rewrite inconsistencies may be safe to
  ignore after successful verification.
- [kopia/kopia#4885](https://github.com/kopia/kopia/issues/4885) covers
  maintenance rewrite failures caused by missing or corrupt pack blobs,
   with
  `kopia content verify` as the recommended first damage assessment.

The six-constraint check:

- Is it really upstream's fault?
   No. The local evidence shows missing pack blobs
  behind a FUSE-backed filesystem repository.
   It does not prove a Kopia defect.
- Can upstream fix it?
   Not established.
   Kopia cannot restore pack blobs that the
  storage backend no longer exposes.
- Are they supporting this use case?
   Partly.
   Kopia supports filesystem
  repositories and documents that unsupported or inconsistent filesystems can
  corrupt repositories.
- Would the repo welcome our contribution?
   Not evaluated further because the
  first constraint failed.
- Will they likely fix it?
   Not evaluated further because the first constraint
  failed.
- Have we prototyped a minimal fix compatible with their architecture?
   No. A
  code fix is not identified because the demonstrated repair was repository
  data repair,
   not a Kopia source change.

Decision:
 do not file a new upstream issue.
 There is no additive comment for the
existing issues because this incident matches the already documented missing-pack
class and adds no source-level Kopia defect.
