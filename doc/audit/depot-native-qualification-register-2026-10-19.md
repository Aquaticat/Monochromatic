# Native capability qualification register

Status date:
2026-10-19.
Evidence root:
`doc/audit/`.

## Qualified

- Automatic registration for `pull_request` and for `push` on the default branch,
  for both PR-merge and direct-push landing:
  [registration control](depot-registration-control-2026-10-18.evidence.json).
- Duplicate execution on GitHub and native Depot for one side-effect-free workflow:
  [duplicate control](depot-duplicate-control-2026-10-18.evidence.json).
- Native check names use `<workflow> / <job>` from app `219785`:
  [registration control](depot-registration-control-2026-10-18.evidence.json).
- Parallel-step default and all-run semantics:
  [native step semantics](depot-native-step-semantics-2026-10-18.evidence.json).
- Explicit native dispatch of the current baseline workflow:
  native workflow `current-baseline` is registered and dispatchable by API.
- Explicit local run of the weekly native matrix:
  native runs `dmjf38bcz0`,
  `r2mxbc40rh`,
  `xv1dwhq3h4` and
  `130wfntbg4` are the bounded matrix executions.
- Weekly matrix fast subset and Android consumer:
  qualified by runs `dmjf38bcz0` and `r2mxbc40rh`.
- Weekly matrix static baseline:
  reproduced the known whole-tree findings rather than passing.

## Not qualified

- Weekly matrix BuildKit category:
  rootless Podman cannot create the user namespace in the native sandbox.
  `PODMAN_USERNS=host` did not fix it.
  A rootful Podman command is needed before this category is qualified.
- Weekly matrix VM category:
  the vmsync path defect is fixed,
  but the sandbox has no `virsh` or libvirt.
  The category is incomplete until a libvirt-capable sandbox is admitted.
- Paused-session SSH,
  `--ssh-after-step`,
  tmate and interactive session strings.
  The bounded attempts could not determine the default branch and skipped the local patch,
  so no job or session was reached:
  [paused-session control](depot-paused-session-qualification-2026-10-18.evidence.json).
  Decision:
  do not rerun in this rollout.
  The feature is excluded from the weekly matrix and no recurring capability depends on it.
  A later rerun requires a checkout with working default-branch detection and an interactive
  observer.
- Fork-triggered Depot runs:
  excluded by design because Depot native workflows are dispatch-only.
- Dependabot-triggered Depot runs:
  no Dependabot configuration exists;
  excluded by design.

## Rules retained

- Native automatic registration stays enabled,
  but paid native profiles use explicit dispatch so admission and duplicate execution stay under
  control.
- The weekly matrix is dispatch-only.
- Publication stays GitHub-hosted.
- A capability with no qualified command is recorded incomplete for that period.
