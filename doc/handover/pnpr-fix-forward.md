# Handover: pnpr fix-forward and the publish 401

## Purpose

Record the held `0.1.0-alpha.16` lockstep repin for the pnpr registry, the owner decisions behind it,
and the separate `pnpr-publish` 401 incident, so the next turn can finish either without re-deriving
the measurements.

## Owner decisions (2026-10-21)

- The person runs the runbook host steps now (stop, `pnpr upgrade-storage`); the agent pushes the held
  lockstep commit only after the person confirms the conversion.
- No pre-conversion snapshot ("Skip it, republish on failure"). Recovery republishes through
  `pnpr-publish`. This recovery path is currently impaired by the 401 incident below; see
  `doc/troubleshooting/pnpr-oidc-github-actions-discovery.md` for the outage record.

## Held lockstep commit (uncommitted)

Commit after the person confirms the storage conversion. Re-verify first with
`mise run //package/config/pnpr:lint:types` and `mise run //package/config/pnpr:test:unit`, then one
commit with explicit pathspecs and the message before `--` (`fix(config-pnpr): ...`). Coolify Watch
Paths auto-deploy on `package/config/pnpr/{config.yaml,Containerfile,compose.yaml}`, so the
Containerfile pin and the `/npm` URL moves must land together.

Files and edits held in the worktree:

1. `package/config/pnpr/Containerfile`: comment names the alpha.16 base and the `pnpr upgrade-storage`
   gate; `FROM` pinned to
   `ghcr.io/aquaticat/pnpr:0.1.0-alpha.16-oidc-workload-discovery.01dc1384276b@sha256:09a9818eaebba777848f3d01382c97143e232d95085ea4950408ad436505109c`
   (image workflow run `39646035147`).
2. `package/config/pnpr/src/publish-steps.ts` (`registry` constant): publish target becomes
   `new URL(\`${origin}/npm/~${target.registryName}/\`)` because the alpha.16 base nests npm at `/npm`.
3. `package/config/pnpr/src/registry-read.ts`: the tarball URL template becomes
   `\`${origin}/npm/${name.replace('/', '%2f')}\``.
4. `package/config/pnpr/src/publish-plan.ts`: comment updated to the `/npm/~<name>/` form and the
   `0.1.0-alpha.11` root-form history.
5. `package/config/pnpr/src/publish-retry.unit.test.ts`: `FORBIDDEN_OUTPUT` keeps the verbatim
   root-form URL from run `34922532212` (historical quote) plus a moved-identifier note of the
   post-move URL (WR6).
6. `doc/decision/private-npm-registry.md`: moved-identifier note after the root-form `.npmrc` record.
7. `doc/planning/private-npm-registry.md`: moved-identifier note after the root-form `.npmrc` record.
8. `package/config/pnpr/README.md`: `.npmrc` block flipped to
   `@monochromatic-dev:registry=https://pnpr.c.aquati.cat/npm/~monochromatic-dev/` with a
   moved-identifier note (moved 2026-10-21 from `.../~monochromatic-dev/`, the `0.1.0-alpha.11` root
   surface).

If the worktree loses these edits, redo them from this list; the URL shapes, the pin digest, and the
gate order are also recorded in `doc/troubleshooting/pnpr-base-move.md` and in the runbook section
`## Move to a newer pnpr base` of `doc/runbook/deploy-pnpr-registry.md`. After the push, run the
runbook `### What to check` list (it includes dispatching `pnpr-publish`).

## Publish 401 incident (separate incident)

Boundary (XIC): separate from the 2026-10-21 deploy outage. User-visible boundary is the
`pnpr-publish` workflow run failing `401 Unauthorized` on every `npm publish` PUT; the outage was a
registry crash loop after the alpha.16 repin.

### Evidence

- Last success: run `38774367340` at 2026-10-15T17:05:08Z. First failure: run `38838410358` at
  2026-10-16T02:03:09Z. Every run since fails the same way (`gh run list --workflow=pnpr-publish.yml`).
- Only auth-path change in that window: `39fc0da926` (generator source) and `15e8a365d1`
  (regenerated `package/config/pnpr/config.yaml`), both "trust the transferred repository owner":
  `repo:Aquaticat/Monochromatic` to `repo:Aquaticats/Monochromatic`, `repository_owner_id` `66041952`
  to `343218767`, `workflow_ref` owner segment likewise.
- Failure text (run `39654896517`):
  `npm error 401 Unauthorized - PUT https://pnpr.c.aquati.cat/~monochromatic-dev/@monochromatic-dev%2ftranslation-repair-markup`.
- Every server-side rejection collapses to one 401 (`rejected()` at
  `pnpr/crates/auth/src/oidc.rs:243` returns `Unauthenticated { resource: "OIDC credentials" }`;
  a failed workload lookup returns `resource: "OIDC workload credentials"` at
  `pnpr/crates/pnpr/src/server/authentication.rs:267`). npm prints no response body for these, so
  the run log alone cannot distinguish the branch.

### Exonerated (probes run 2026-10-21)

- npmrc auth key shape and token send: with npm `11.20.0` on node `v26.12.0` (the workflow's own
  toolchain) a local echo server saw `authorization: Bearer <token>` for the exact key
  `//<host>/~monochromatic-dev/:_authToken` the tooling writes; `${NODE_AUTH_TOKEN}` interpolation
  works. Probe artifacts: `${HOME}/temp/agent/npmrc-probe-2026-10-21/`.
- `publish-steps.ts` passes `NODE_AUTH_TOKEN` in the spawn env and prefixes the minted token with
  `pnpr_workload_`, which `authentication.rs:260` strips before verification.
- Trust values match the live repository: `gh api /repos/Aquaticats/Monochromatic` reports id
  `710240121`, owner id `343218767`, full name `Aquaticats/Monochromatic`.
- Production clock: response `Date` header matched local UTC within seconds. GitHub's discovery
  document still omits `authorization_endpoint` (the patched base tolerates that).

### Ranked hypotheses

1. GitHub's minted `sub` or one of `repository_id` / `repository_owner_id` / `workflow_ref` differs
   in value or JSON type from the regenerated trust strings (type matters: `binding_matches` at
   `pnpr/crates/auth/src/oidc/workload.rs:131` compares with `Value::as_str`).
2. Signature or metadata verification fails (`verify_workload_token` at
   `pnpr/crates/auth/src/oidc/workload_verification.rs:44`), so no binding is even consulted.
3. Production serves a trust config other than the regenerated one (weaker: the 2026-10-21 rollback
   redeployed from this tree).

### Probe

A temporary `[DEBUG-401]` step in `.github/workflows/pnpr-publish.yml` (path pinned by the trust
claim `workflow_ref`, so the token is the real one) prints the decoded claims (never the token) and
sends one publish-shaped `PUT` for `@monochromatic-dev/oidc-claims-probe`, which is outside the trust
list: `check_workload_request` at `pnpr/crates/pnpr/src/server/oidc.rs:304` refuses it with 403 when
auth works, and nothing can be published. Compare the printed claims to the `auth.oidc` block of
`package/config/pnpr/config.yaml`, then fix the trust strings or record the verification finding in
`doc/troubleshooting/pnpr-oidc-github-actions-discovery.md`. Remove the `[DEBUG-401]` step when the
incident closes.

## Next actions (order)

1. Person confirms the storage conversion, then commit and push the held lockstep repin (above) and
   run the runbook `### What to check` list.
2. Read the `[DEBUG-401]` step output, compare claims to the trust config, fix or record.
3. Remove the `[DEBUG-401]` step and close the incident in the troubleshooting doc.
