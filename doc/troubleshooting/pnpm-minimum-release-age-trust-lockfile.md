# pnpm strict `minimumReleaseAge` rejects immature packages in non-interactive installs

## Symptom

`mise run prepare:pnpm:install` can fail before dependency migration work completes when the lockfile already references
recent package versions and the session is non-interactive.

The observed failure was:

```text
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 4 lockfile entries failed verification
```

Affected entries in this run were:

```text
@earendil-works/pi-agent-core@0.78.1
@earendil-works/pi-ai@0.78.1
@earendil-works/pi-coding-agent@0.78.1
@earendil-works/pi-tui@0.78.1
```

The install succeeded with:

```bash
env PNPM_CONFIG_TRUST_LOCKFILE=true mise run prepare:pnpm:install
```

### Fresh resolution without a lockfile

pnpm 11.15.1 also rejected an intentionally adopted dependency during fresh resolution:

```console
$ pnpm install --filter @monochromatic-dev/cli-wg-allowedips --lockfile=false --ignore-scripts
[ERR_PNPM_NO_MATURE_MATCHING_VERSION] 2 versions do not meet the minimumReleaseAge constraint:
  cidr-tools@12.1.3 ...
  ip-bigint@9.0.7 ...
```

The command explicitly disabled lockfile reads and writes,
so it had no reviewed resolution for `trustLockfile` to trust.
The accepted versions had already passed the source,
artifact,
runtime-graph,
and consumer validation recorded in
`doc/audit/tech-wg-allowedips-cidr-library-vet-2026-07-28.md`.
The matching bounded workaround is a version-specific exclusion for each exact audited release,
not a bare package-name exclusion.

## Root cause

The workspace enables `minimumReleaseAgeStrict`,
 so pnpm treats immature package resolutions as policy violations.
In pnpm 11.5.1,
 non-interactive strict installs cannot prompt,
 so the policy handler throws instead of adding
`minimumReleaseAgeExclude` entries.

`/var/home/user/.local/share/mise/installs/npm-pnpm/11/lib/node_modules/pnpm/dist/pnpm.mjs:167730`:

```javascript
const inCi = opts2.ci ?? import_ci_info2.isCI;
const canPrompt = !inCi && Boolean(process.stdin.isTTY);
return {
  handleResolutionPolicyViolations: async (violations) => {
    if (!strictMode)
      return;
    const immature = filterImmatureViolations(violations);
    if (immature.length === 0)
      return;
```

`/var/home/user/.local/share/mise/installs/npm-pnpm/11/lib/node_modules/pnpm/dist/pnpm.mjs:167742`:

```javascript
if (canPrompt) {
  await promptForApproval(immature);
} else {
  throw failOnImmature(immature);
}
```

The thrown error text comes from `failOnImmature`.

pnpm 11.15.1 retains that path at
`~/.local/share/mise/installs/pnpm/11.15.1/dist/pnpm.mjs:196967-196973`:

```javascript
function failOnImmature(immature) {
  const sorted = [...immature].sort((a2, b) => `${a2.name}@${a2.version}`.localeCompare(`${b.name}@${b.version}`));
  const list2 = sorted.map((v) => `  ${v.name}@${v.version} ${v.reason}`).join("\n");
  return new PnpmError("NO_MATURE_MATCHING_VERSION", `${sorted.length} ${sorted.length === 1 ? "version does" : "versions do"} not meet the minimumReleaseAge constraint:
${list2}`, {
    hint: "Run the install interactively to approve these picks, or add them to minimumReleaseAgeExclude in pnpm-workspace.yaml, or wait for the packages to mature past the configured cutoff."
  });
}
```

The original pnpm 11.5.1 source was at
`/var/home/user/.local/share/mise/installs/npm-pnpm/11/lib/node_modules/pnpm/dist/pnpm.mjs:167760`:

```javascript
function failOnImmature(immature) {
  const sorted = [...immature].sort((a2, b) => `${a2.name}@${a2.version}`.localeCompare(`${b.name}@${b.version}`));
  const list2 = sorted.map((v) => `  ${v.name}@${v.version} ${v.reason}`).join("\n");
  return new PnpmError("NO_MATURE_MATCHING_VERSION", `${sorted.length} ${sorted.length === 1 ? "version does" : "versions do"} not meet the minimumReleaseAge constraint:
${list2}`, {
    hint: "Run the install interactively to approve these picks, or add them to minimumReleaseAgeExclude in pnpm-workspace.yaml, or wait for the packages to mature past the configured cutoff."
  });
}
```

`PNPM_CONFIG_TRUST_LOCKFILE=true` maps to `trustLockfile`.
 The install path skips lockfile resolution verification when
that option is set.

`/var/home/user/.local/share/mise/installs/npm-pnpm/11/lib/node_modules/pnpm/dist/pnpm.mjs:162332`:

```javascript
if (!willDelegateToPacquet && !opts2.trustLockfile) {
  const cacheActive = opts2.cacheDir != null && opts2.resolutionVerifiers.length > 0;
  const wantedLockfilePath = cacheActive ? path128.resolve(ctx.lockfileDir, await getWantedLockfileName({
    useGitBranchLockfile: opts2.useGitBranchLockfile,
    mergeGitBranchLockfiles: opts2.mergeGitBranchLockfiles
  })) : void 0;
  try {
    await verifyLockfileResolutions(ctx.wantedLockfile, opts2.resolutionVerifiers, {
```

## Verification

Version under test:

```bash
mise exec -- pnpm --version
# 11.5.1
```

Failure pattern:

```bash
mise run prepare:pnpm:install
```

This fails in a non-interactive session when current lockfile entries violate the release-age verifier.

Working pattern used for the dependency migration:

```bash
env PNPM_CONFIG_TRUST_LOCKFILE=true mise run prepare:pnpm:install
```

This succeeded and produced the intended lockfile update for replacing `shell-quote` with `unbash`.

## Verified workarounds

### Trust the reviewed lockfile for one install

```bash
env PNPM_CONFIG_TRUST_LOCKFILE=true mise run prepare:pnpm:install
```

Tradeoff:
 pnpm skips lockfile resolution verification for that invocation.
 Use only when the lockfile diff is expected,
reviewed,
 and limited to the dependency change being made.

### Add explicit release-age exclusions

Add the rejected packages to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`,
 then rerun the normal install.

Use one entry per package,
 not one entry per version.
A bare name (`@scope/pkg`) exempts every version;
 a single `||` union (`@scope/pkg@1.0.0 || 1.1.0`) exempts the listed versions.
Listing the same name on multiple `name@version` lines does not work:
 pnpm honors only the first listed version per name and silently drops the rest,
 which is the exact shape `pnpm audit --fix` accumulates.
See `doc/troubleshooting/pnpm-minimum-release-age-exclude-first-match.md`.

Tradeoff:
 the exclusion is durable policy.
 Use it only when the immature version is intentionally accepted for future
installs too.

For an externally audited dependency,
prefer the exact form:

```yaml
minimumReleaseAgeExclude:
- 'cidr-tools@12.1.3'
- 'ip-bigint@9.0.7'
```

This admits only the inspected releases and leaves future versions behind the age gate.

### Wait for package maturity

Rerun the normal install after the package versions pass the configured release-age cutoff.

Tradeoff:
 this blocks urgent dependency work until registry age catches up.

## What does not work

Running the same install again in a non-interactive agent session does not help.
 pnpm cannot prompt,
 so it reaches
`failOnImmature` again.

Using `PNPM_CONFIG_TRUST_LOCKFILE=true` with `--lockfile=false` does not provide the reviewed-lockfile workaround.
The command has prohibited itself from reading a lockfile and must resolve the immature release again.

Using `--no-save` with strict release-age approval is not a substitute.
 The source has a separate guard for that case.

`/var/home/user/.local/share/mise/installs/npm-pnpm/11/lib/node_modules/pnpm/dist/pnpm.mjs:167738`:

```javascript
throw new PnpmError("STRICT_MIN_RELEASE_AGE_REQUIRES_SAVE", "minimumReleaseAgeStrict cannot be combined with --no-save: approval would require writing to minimumReleaseAgeExclude in pnpm-workspace.yaml, which --no-save prevents.", {
  hint: "Drop --no-save so the exclude list can be persisted, or set minimumReleaseAgeStrict: false to let the install proceed without prompting (the lockfile would still trigger the auto-collect on the next normal install)."
});
```

## Draft upstream issue

Do not file as-is.

### Why this is not filed upstream

1.  Is it really upstream's fault?
     No. pnpm is enforcing configured release-age policy in a non-interactive session.
2.  Can upstream fix it?
     Not applicable because the observed behavior is the intended policy path.
3.  Are they supporting this use case?
     Yes.
     The error hint names the supported choices:
     interactive approval,
    `minimumReleaseAgeExclude`,
     or waiting.
4.  Will they likely fix it?
     Not applicable because this is not a defect report.
5.  Have we prototyped a minimal fix compatible with their architecture?
     No. A code fix is not appropriate for a
    repository-policy gate.

Searched for an existing upstream issue with:

```bash
gh search issues "pnpm minimumReleaseAge trust-lockfile NO_MATURE_MATCHING_VERSION" --repo pnpm/pnpm --limit 5
```

The search returned no matching issues.
 No upstream issue should be opened for this repository-specific install choice.
