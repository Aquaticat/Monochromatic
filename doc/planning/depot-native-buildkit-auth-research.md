# Native CI job authentication for container builds

## Scope and admission

This follow-up closes a cross-product boundary identified during the complete documentation audit.
The existing BuildKit campaign used the existing local user login.
Its successful builds and subsequent pull-token consumers do not establish that a native CI job can
build or read registry content using its automatically injected credentials.

Application inputs remain frozen at `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Experiment source belongs in a new isolated worktree.
Production workflows and the parent's repeated DAG inputs remain unchanged.

The parent admitted this finite follow-up on `2026-10-18`:

- One native `2 CPU`, `8 GiB` job with a five-minute server timeout.
- One default `16 CPU`, `32 GiB` AMD64 builder with a five-minute project build timeout.
- One newly owned temporary project, with autoscaling disabled,
  `keepGb: 25` and `keepDays: 1`, subject to the existing verified schema minimum.
- An additional `USD 1` campaign guard.
  Reserving the complete admitted windows at the public rates gives
  `5 × USD 0.006 + 5 × USD 0.04 = USD 0.23` of timestamp-compute arithmetic.
  This is not an observed invoice or a guarantee covering uninspected account usage and storage.
- No persistent token or secret, organization setting, broad credential, paid model,
  production image, or account-wide listing.
- Source review, local positive and rejected-input controls, and a recorded admission precede allocation.
  A bounded observer must retain terminal status and owned-resource cleanup.

The parent confirmed its native slot is free and will hold the native DAG matrix until this job is terminal.
No cloud resource has been created for this follow-up at the time of this admission record.

## Deciding source

The complete deployed [native CI container-build integration][native-builds] says trusted native jobs
receive a short-lived `DEPOT_TOKEN` for builds and the organization's registry.
Fork pull requests do not receive it.
The name is reserved, and the injected token replaces a secret with that name during preparation.
The guide explicitly says these jobs need no project OIDC trust relationship or stored Depot token.

The installed CLI source at `1f96d6d488f938de97ea640b115e9567ebfd6fbf` resolves the explicit token,
then `DEPOT_TOKEN`, then stored login in `pkg/helpers/token.go`.
Its later fallback also considers OIDC, `DEPOT_JIT_TOKEN`, and `DEPOT_CACHE_TOKEN`.
The experiment must isolate the CLI home and configuration and remove those alternatives from its
child-process environment, rather than treating token presence as proof of the credential actually used.
The source is retained in the [platform source archive][sources].

`pkg/buildx/commands/build.go` authenticates before beginning a build.
`pkg/registry/cli.go:WithDepotSave` preserves a local exporter and appends an image exporter for `--save`.
That permits an exported-file consumer and a saved image from one build request.
Successful export, build authorization, and a subsequent registry request remain distinct assertions.

The [GitHub Actions integration][github-builds] requires a project trust relationship for its
recommended OIDC route.
That is a different credential contract from the native job injection.
This follow-up does not create a GitHub trust relationship or qualify the GitHub OIDC route.

## Planned consumer and evidence

The producer will copy the exact frozen first-party
`package/module/p-limit-fork/src/task-queue.ts` into a bounded context.
A pinned Node base will execute a queue consumer and export its source binding and observed results.
The native job must read and independently validate the resulting files.
This is a narrow first-party consumer, not the package's complete unit-test owner or a performance sample.

A missing-token control must fail before build admission with an isolated home and no alternate credential.
The positive build receives only the injected job token as its Depot credential.
Registry requests must use that same credential and target only exact admitted references.
Local user authentication cannot be used to turn a failed registry control into a passing job-token claim.
The parent controller may use the existing local login only to create and clean the solely owned project
and retrieve this campaign's own status and artifacts.

The receipt must retain the committed harness, project creation bounds, native job and attempt identities,
build identity, exporter and image digests, raw artifact checks,
negative-control output, independent consumer results, and deletion or absence responses.
Failures remain evidence and do not authorize an unrecorded replacement allocation.

[native-builds]: https://depot.dev/docs/container-builds/integrations/depot-ci
[github-builds]: https://depot.dev/docs/container-builds/integrations/github-actions
[sources]: ../audit/depot-platform-surface-sources-2026-10-18.evidence.json.gz
