# cli-git rejects a manual tag push with `spawn /usr/bin/git EAGAIN`

## Symptom

Pushing a single tag through the wrapped `git` failed three times in a row on 2026-09-06:

```text
git push origin '@monochromatic-dev/module-logger@0.1.0'
{"schemaVersion":1,"sequence":0,"type":"engine-failure","code":"plugin-threw","message":"spawn /usr/bin/git EAGAIN","trigger":"manual-push","policyId":"final-newline"}
```

The tag existed locally (`git tag -a '@monochromatic-dev/module-logger@0.1.0' dfa0e0d58 -m ...` succeeded).
Commit auto-pushes through the same wrapper kept working before and after
(`git status -sb` showed `main` in sync with `origin/main` between attempts).

## What was ruled out

- Process limit:
   305 processes for the user against `ulimit -u` of 8192.
- Memory:
   `free -g` showed 30 GiB available.
- Transient state:
   the failure repeated identically across three attempts several minutes apart,
   with a commit push succeeding in between.

So the `EAGAIN` comes from how the `final-newline` policy spawns `git` on the `manual-push` trigger
for a tag ref,
not from host exhaustion.
The plugin source was not read during this incident;
that is the next step when someone picks this up.

## Verified workaround

Create the tag through the GitHub API instead of pushing it:

```text
gh release create '<tag>' --target <full commit SHA> --title '<tag>' --notes-file <notes>
```

`--target` needs the full 40-character SHA;
the short form is rejected with `Release.target_commitish is invalid`.
GitHub creates a lightweight tag at that commit and the release in one call.
Afterwards delete the local annotated tag (`git tag -d '<tag>'`) before `git fetch --tags`,
or the fetch refuses to clobber it.

`doc/runbook/publish-npm-package-first-time.md` uses this path for the bootstrap version's tag.

## Open follow-up

Read `package/git-policy/cli` for the `final-newline` policy's `manual-push` handling of tag refs
and reproduce with a throwaway tag on a linked worktree;
the spawn arguments for a ref that is not a branch are the first suspect.
