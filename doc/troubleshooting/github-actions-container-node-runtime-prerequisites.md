# GitHub checkout de0fac2e and Node 26 fail in unqualified job containers

## Symptom

The isolated service-container research profile exposed separate checkout and runtime prerequisites.
The [primary context receipt](../audit/depot-container-prerequisites-2026-10-18.evidence.json)
retains source captures,
selected diagnostic lines and full returned-log hashes.

GitHub run `39109462308`,
source `1438ecde4b643a606e0a75f85067e3d0153e9bb5`,
printed this checkout diagnostic in its standard AMD64,
Depot AMD64 and Depot ARM64 job containers:

```text
The repository will be downloaded using the GitHub REST API
To create a local Git repository instead, add Git 2.18 or higher to the PATH
```

The workflow ultimately concluded `cancelled`.
Those lines establish fallback selection;
they do not identify the cause of the subsequent REST download stall.

After provisioning Git,
run `39112162357` at `9779cb896b92969b84f45e2737117231638aa700`
passed checkout but failed while Mise tried the locked Node `26.12.0` executable:

```text
node: error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory
```

Mise reported exit `127`.
The image's existing Node `24.22.0` health check did not exercise that executable.

## Root cause

### Checkout's Git initialization and fallback selection

The exercised checkout source is `actions/checkout` commit
`de0fac2e4500dabe0009e67214ff5f5447ce83dd`.
A shallow source clone matches every API-captured deciding file byte for byte.
`src/git-command-manager.ts:670` resolves a required Git executable:

```typescript
// actions/checkout/src/git-command-manager.ts:670
this.gitPath = await io.which('git', true)
```

The same file declares minimum Git `2.18` at line 15 and checks the discovered version at line 688.
`src/git-source-provider.ts:361` calls the manager constructor;
its catch returns `undefined` when LFS was not requested:

```typescript
// actions/checkout/src/git-source-provider.ts:366
} catch (err) {
  // Git is required for LFS
  if (settings.lfs) {
    throw err
  }

  // Otherwise fallback to REST API
  return undefined
}
```

The `if (!git)` branch at `src/git-source-provider.ts:77`
prints the quoted diagnostics and awaits `githubApiHelper.downloadRepository`.
Initialization failures other than a missing executable can reach this branch.
The [direct original-image control](../audit/depot-original-service-git-2026-10-18.evidence.json)
separately proves that the original AMD64 image's default `PATH` contains no Git:
`spawnSync('git', ['--version'])` returns `ENOENT`,
every candidate path is absent,
a valid Node subprocess succeeds and a deliberately absent-command control returns `ENOENT`.
That control does not reproduce the historical jobs' exact environment or qualify ARM Git absence.

### Locked Node's runtime library

The loader diagnostic identifies the missing `libatomic.so.1` dependency for the actual Node 26 executable.
The corrected derived image adds Debian `libatomic1=12.2.0-14+deb12u1`.
Its [runtime receipt](../audit/depot-service-containers-2026-10-18.evidence.json)
checks executable identities and loaded library mappings for locked Node 26,
separately from the base image's Node 24.
This is an image prerequisite correction;
no Node source defect or cause for the REST stall is established.

## Verification

The failing catalog consists of the original REST-fallback workflow and the subsequent Node-loader workflow.
The successful catalog is source `5485cc0d12805f330d568b358e5ff0bb988d4d37`:
four native Depot and six GitHub host/job-container consumers passed.
They check actual HTTP success and missing-path responses,
nonce/source identities and the locked runtime.
GitHub run `39113547458` has six successful jobs.

The published receipt binds the runnable historical research tasks and original ten ZIPs.
It preserves all container/runtime identities and cleanup outcomes.
The image digest is
`sha256:853b99050d5420698a02d7cb10978be8824dc0999c9ace08ec453706da54ec31`.
The solely owned registry project and temporary pull-secret variants were removed after their consumers;
retained OCI graphs support offline image inspection.

## Verified workarounds

Build the job-container image with the exercised Git and runtime packages through the existing image owner.
The derived image provides Git `2.39.5` and the measured `libatomic1` package.
The tradeoff is maintaining and checking those additional image prerequisites for each target architecture.
The Node 26 consumer remains mandatory when an image health check uses Node 24.
The declared frozen workload and lockfile remain unchanged.

The image's Git `2.39.5` qualifies this checkout consumer.
It does not satisfy the Git-policy fixture's exact Git `2.56` requirement.

## What does not work

- Treating REST-fallback selection alone as proof of missing Git or as the cause of the download stall.
- Treating a successful Node 24 health check as verification of the installed Node 26 executable.
- Adding Git alone:
  checkout advanced,
  but the locked runtime still failed with the loader diagnostic.
- Treating job-level `job.services` expressions as interchangeable with supported step environment expressions:
  the [context recurrence](github-actions-job-env-runner-context.md#service-container-context-recurrence)
  retains that separate validation boundary.

## Upstream filing decision

- Responsibility:
  the measured missing prerequisites belong to our image;
  responsibility for the REST stall is unresolved.
- Fixability:
  the derived-image correction passed actual consumers without an upstream patch.
- Supported usage:
  checkout explicitly describes its Git minimum and fallback path.
- Contribution acceptance:
  the inspected `actions/checkout/CONTRIBUTING.md` describes external pull requests,
  tests and generated distribution updates;
  no contribution is proposed for these image prerequisites.
- Maintainer direction:
  the inspected implementation deliberately selects the fallback;
  no upstream decision about the unresolved stall is inferred.
- Prototype:
  the actual image and ten passing consumers establish the local remedy;
  no upstream software fix is claimed.

Nothing additive is ready to file upstream.
The unresolved REST behavior remains an observation,
without a claimed transport cause or upstream defect.
