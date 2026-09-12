# Git wrapper cannot find Node in an agent command context

## Symptom

On 2026-09-12,
a Bash-tool invocation of `git status --short` failed before the Git policy CLI loaded:

```text
/var/home/user/Monochromatic/node_modules/.bin/git: line 48: exec: node: not found
```

`command -v node` in that command context returned exit 1.
Its `PATH` contained `/home/user/.local/share/mise/installs/node/26.8.1/bin`.
The inspected installation directory did not contain that version.
Direct execution of the retained Node 26.7.0 binary returned `v26.7.0`.

This is separate from the preparation-receipt TypeScript and lint findings.
Their verification processes reached the compiler and linter successfully.

## Source trace and limits

The installed repository wrapper at `node_modules/.bin/git:40` checks adjacent Node binaries,
then a command-resolved binary,
and finally executes bare `node`:

```sh
# node_modules/.bin/git:42 through 49
elif [ -x "$basedir/node" ]; then
  exec "$basedir/node"  "$basedir/../@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs" "$@"
elif command -v node >/dev/null 2>&1; then
  exec node  "$basedir/../@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs" "$@"
elif [ -n "$exe" ] && command -v node.exe >/dev/null 2>&1; then
  exec node.exe  "$basedir_win/../@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs" "$@"
else
  exec node  "$basedir/../@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs" "$@"
```

The diagnostic and failed lookup establish the boundary that failed.
They do not establish which component constructed that command's `PATH`.
No claim is made that Node was uninstalled globally,
that Git policy failed,
or that Mise introduced the missing entry.

## Verification

Working observations:

- Direct Node 26.7.0 execution returned its version with exit 0.
- Prepending that installation's `bin` directory for `git status --short` returned the expected scoped changes.
- The receipt verification driver used its own `process.execPath` directory for child-command lookup.
  `preparation-receipt-verification-r3-20260912.out` records successful build,
  types,
  tests and lint under that runner.

Failing observations:

- Bare `command -v node` in the affected Bash-tool context returned exit 1.
- The repository Git wrapper's bare lookup failed with the quoted diagnostic and exit 127.

The process manager did not reproduce the failing context:
`stale-node-path-probe-20260912.out` resolved Node 26.7.0.
A follow-up replacing only its Node-installation path component still resolved Node 26.8.2:
`stale-node-path-probe-controlled-20260912.out`.
Those scripts' expected-failure assertions were incorrect harness assumptions,
not additional tool failures or evidence that the Bash-tool context recovered.

## Observed recovery

The owner reported running `mise upgrade` in the translation-repair worktree,
then restarted the terminal and session.
The agent's subsequent Bash-tool probe returned:

```text
/home/user/.local/share/mise/installs/node/26.8.2/bin/node
v26.8.2
```

An agent probe between the upgrade report and the restart still returned exit 1 for `command -v node`.
This sequence records the observed recovery boundary;
it does not isolate the upgrade and restart as independent causes.
The command-local override is no longer needed in the recovered context.

## Verified workaround

The agent used a command-local override,
not a global installation or configuration change:

```bash
# Run from the intended worktree; the retained executable was verified with --version first.
PATH="${HOME}/.local/share/mise/installs/node/26.7.0/bin:$PATH" git status --short
```

For the already-running Node verification driver,
child commands received `dirname(process.execPath)` prepended to their inherited `PATH`.
This preserves the runner selected for that verification.
The tradeoff is explicit runtime selection:
it does not adopt a newly installed version or repair the parent harness environment.
Revalidate the executable before reuse;
the version in this incident is evidence,
not a repository-wide pin.

## What does not work

A managed-process probe is not interchangeable with the failed Bash-tool surface.
Replacing only one path component also failed to recreate the full lookup conditions.
Do not infer the original context's resolution from either successful managed probe.

## Upstream filing decision

- Upstream fault:
  not established;
  the evidence concerns a local command environment.
- Upstream fix:
  no source defect was identified to patch.
- Supported use case:
  no failing upstream API or unsupported combination was established.
- Contribution policy:
  not assessed because there is no candidate upstream report.
- Maintainer disposition:
  not assessed for the same reason.
- Prototype:
  the command-local consumer workaround was exercised;
  no upstream patch is warranted by this evidence.

Nothing to file or add upstream.
No issue draft or external communication was created.
