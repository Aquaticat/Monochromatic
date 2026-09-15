# cli-git policies that add paths to a commit

## Status

Implementation plan for the owner decision recorded 2026-09-15 in
 `doc/decision/private-npm-registry.md` ("Versions change only by manual bumps"):
 extend the cli-git commit transaction so a policy pass can add paths to the commit
 and write those fixes to the worktree when the worktree copy still matches `HEAD`.
The first consumer is the dependent-bump policy.
Not started in code.

## Requirements carried from the decision

- A hand bump of a workspace manifest `version` bumps every dependent by patch,
   transitively,
   in the same commit.
- An edge counts when the dependent reaches the bumped package through `dependencies`,
   `peerDependencies`,
   or `optionalDependencies`,
   or imports it from non-test source as a bundled `devDependency`.
- The dependent's manifest joins the commit,
   and its worktree copy is rewritten so `git status` stays clean.
- SPEC,
   `doc/decision/cli-git-policies-platform.md`,
   and the fixtures are updated for every commit mode.
- The changesets `version` job in `npm-release.yml` runs the same ripple (Task 8),
   so the ripple computation must be callable outside cli-git.
- No CI backstop.

## Current engine limits (measured 2026-09-15)

- Policies see only candidates:
   `LazyPolicyGitFacts` in `package/git-policy/cli/src/api/context-types.ts` exposes
   `candidates`,
   `headOid`,
   `landedCommitOid`,
   and `pushUpdates`;
   nothing lists or reads other tracked files.
- A patch must name a pass-start candidate:
   `applyPolicyPatches` (`package/git-policy/cli/src/policy-engine/apply-policy-patches.ts` lines 99 to 112)
   returns `patchTargetFailure` for any other target.
- `runCommitTransaction` (`package/git-policy/cli/src/policy-engine/commit-transaction.ts`)
   computes `candidatePaths` once before the convergence loop
   and passes the same list to `preparePostIndex` and `prepareTransactionJournal` as `selectedPaths`.
- Patches apply with `git apply --cached --3way` to the private index only;
   `SPEC.md` "Transaction protocol" says never mutate the real index or worktree while evaluating policies,
   and no commit phase writes the worktree.
- `executePreparedCommit` (`commit-transaction-finalize.ts`) journals `recordRefUpdated`,
   installs the post index,
   then `recordIndexInstalled`;
   recovery knows no worktree phase.
- Direct fix (`direct-fix.ts`,
   `direct-fix-install.ts`) already installs fixed bytes into the worktree atomically for its pathspec scope.

## Design

### Policy API

- Add `headFiles: (request: Readonly<{ pathspecs: readonly string[] }>) => Promise<readonly CommittedFile[]>`
   to `LazyPolicyGitFacts`.
   It lists `HEAD` tree entries matching Git pathspecs (glob magic allowed),
   each with an opaque `targetId`,
   `path`,
   `revision`,
   `mode`,
   and lazy `bytes`.
   Unborn `HEAD` returns an empty list.
- A `PolicyPatch` whose `targetId` names a `headFiles` entry that is not a candidate asks the engine to add that path.
- Candidates keep precedence:
   a policy merges candidate bytes over `headFiles` bytes to see the pass's current state.
- Every lifecycle implements `headFiles`;
   only `pre-forward` commit transactions and direct fix apply added-path patches.

### Commit transaction

1.   Precondition per added path,
      checked when the patch applies:
      the private commit index entry equals the `HEAD` entry,
      and the worktree file's bytes and mode equal the `HEAD` blob.
      Otherwise the engine fails the pass,
       naming the path and the two remedies
       (stage the path so it becomes a candidate,
        or restore or stash its worktree changes).
2.   The patch applies to the private commit index as today;
      the path then differs from `HEAD`,
      so the next pass sees it as a candidate.
3.   `candidatePaths` becomes the union of the selected paths and every added path,
      recomputed after each changed pass.
4.   Explicit-path mode passes the union as `selectedPaths` to `preparePostIndex`,
      so the post-commit index takes added paths from the landed tree.
      Index mode already copies the private commit index.
5.   The journal records each added path with its original and intended blob OIDs and mode before real Git runs.
6.   After `recordIndexInstalled`,
      the engine rewrites each added path's worktree file
      (same-directory temporary file plus rename,
       mode preserved),
      re-checking that the file still holds the original bytes first,
      then records `worktreeInstalled`.
7.   Read-only selection modes (`--interactive`,
      `--patch`,
      `--include`) keep refusing automatic patches,
      so a needed bump blocks with direct-fix guidance.

### Recovery

A journal interrupted after `indexInstalled` and before `worktreeInstalled`
 checks each added path:
 intended bytes means done,
 original bytes means write the intended bytes,
 anything else blocks with a manual-recovery diagnostic naming the path.

### Dependent-bump policy

- Lives in `package/git-policy/repository` as `mono/dependent-version-bump`,
   registered in `cli-git.config.ts`.
- Publishable manifests are the names listed in `package/config/pnpr/config.yaml`
   (the publish workflow's own source of truth);
   their directories come from `package/*/*/package.json`.
- Bumped packages are publishable manifests whose candidate `version` differs from the `HEAD` version.
- Edges come from the merged current manifests;
   a bundled `devDependency` edge needs an import of the package name,
    or a subpath of it,
    in a file under the dependent's `src/` that is not a `*.test.*` file.
- The policy computes the whole transitive closure in one pass
   and patches every dependent whose current `version` still equals its `HEAD` version,
   so the second pass is stable instead of spending one pass per graph level against the eight-pass limit.
- A patch bump increments the third component;
   no workspace manifest used a prerelease version on 2026-09-15 (0 of 155),
   and 8 had no `version` field and are skipped.
- The pure closure computation is a separate exported module,
   so the `npm-release.yml` changesets job can run it through a package task (Task 8).

### Adopted sub-decisions

- A dependent whose worktree manifest differs from `HEAD` and is not staged blocks the commit.
   This follows from the rejected option in the decision
   (adding paths without updating the worktree leaves reverted versions in `git status`).
- Only publishable manifests are bumped;
   edges still pass through non-publishable packages,
   so a publishable package bundling an unpublished one that depends on the bumped package still bumps.

## Fixtures to add

For each of ordinary staged commit,
 explicit-path commit,
 `--no-only`,
 amend,
 allow-empty,
 and merge,
 cherry-pick,
 and revert conclusions:
 a hand bump adds a clean dependent manifest,
 and the test asserts exact ref,
 index,
 and worktree bytes.
Also:

- dirty dependent worktree manifest blocks with the named remedies;
- staged dependent manifest is patched as a candidate,
   not added;
- `--interactive` and `--patch` block with direct-fix guidance;
- transitive chain longer than eight levels settles in two passes;
- interruption after index install and before worktree install recovers each of the three byte states;
- direct fix adds and writes a clean dependent manifest.

## Next actions

1.   Add `headFiles` to the API types,
      the commit-transaction facts,
      the direct-fix facts,
      and the other lifecycles.
2.   Extend `applyPolicyPatches`,
      `runCommitTransaction`,
      the journal,
      finalize,
      and recovery.
3.   Update `SPEC.md` and `doc/decision/cli-git-policies-platform.md`.
4.   Write the ripple module and the policy with unit tests.
5.   Add the fixtures,
      then verify through the built shim in a disposable repository.
6.   Re-trust the repository configuration,
      which changes when the policy is registered.
