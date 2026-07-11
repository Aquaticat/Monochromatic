# Cli-git push fails after hk retirement because config-based hook remains

## Symptom

The first push after commit `122c5dbd2` removed hk/Pkl provisioning failed with native Git's configured pre-push
command:

```text
test "${HK:-1}" = "0" || hk run pre-push --from-hook "$@": line 1: hk: command not found
error: failed to push some refs to 'https://github.com/Aquaticat/Monochromatic'
```

Cli-git completed its policy gate;
native Git then loaded a stale `hook.hk-pre-push.command` from `.git/config` and could not resolve the retired `hk`
executable.
The remote was unchanged.

## Environment

The checkout used Git 2.54 config-based hooks.
`git config --show-origin --get-regexp '(^|\.)hk([.-]|$)|hooksPath'` reported local
`hook.hk-pre-commit.*` and `hook.hk-pre-push.*` keys.
`.git/hooks/pre-push` remained the unrelated Git LFS hook and contained no hk command.
No global hk key was present on this machine.

## Root cause

Hk 1.50.0's installer writes `hook.hk-<event>.command` and `hook.hk-<event>.event` into local or global Git
configuration.
Those registrations are user or checkout state outside the tracked repository.
Deleting `hk.pkl` and removing the mise tool declaration therefore cannot remove them automatically.
Git correctly continued invoking the configured command after the executable disappeared.

The relevant upstream source is `jdx/hk` tag `v1.50.0`,
`src/cli/install.rs` function `remove_config_entries`.
It enumerates `^hook\.hk-`,
deduplicates names,
and runs `git config <scope> --unset-all <key>`.
The repository-owned migration mirrors that exact ownership prefix without depending on the retired binary.

## Fix

Run the fresh-context procedure in `docs/runbook/remove-retired-hk-git-config.md`.
Its state-changing command is:

```sh
mise run cleanup:hk-git-config -- --local --global
```

The command requires explicit scopes,
resolves real Git without recursing through the package shim,
removes only effective keys beginning with `hook.hk-`,
and reports exact removed names.
Running it again returns empty `removedKeys` arrays.

Do not delete unrelated `hook.*` entries or files under `.git/hooks`.
The cleanup fixture preserves `hook.other.command` in both local and global configuration.

## Verified bridge

Issue `#357` forbids automated verification from mutating real per-user Git state.
The failed checkpoint push was therefore retried as:

```sh
git push --no-verify
```

Native Git skipped the stale hook,
but cli-git still ran its manual-push policies because `--no-verify` is not a cli-git policy bypass.
The push succeeded.
This bridge is suitable only until the owning user runs the explicit cleanup.

`mise run //packages/git-policies/cli:test:hk-config-cleanup` verifies:

- absent local and global config;
- configured local and global hk keys;
- preservation of unrelated hook keys;
- repeated no-op cleanup;
- root mise task flag routing;
- disposable global config through `GIT_CONFIG_GLOBAL`.

## Rejected hypotheses

### Cli-git skipped policy enforcement

Rejected because cli-git settled its manual-push lifecycle before native Git attempted the stale hook command.
The retry used native `--no-verify`,
which cli-git forwards without treating it as a policy escape.

### A legacy hk script remained under `.git/hooks`

Rejected by reading the actual pre-push file.
It is the Git LFS hook;
the hk invocation came from `.git/config` as Git's diagnostic showed.

### Removing the mise tool should remove Git configuration

Rejected because mise owns executable provisioning and the repository lockfile,
not per-user or per-checkout Git configuration.
Removing those declarations cannot safely infer which external Git scopes the user intended to mutate.

## Upstream status

No upstream report is appropriate.
Hk documents `hk uninstall` and `hk uninstall --global` for this state.
The migration failure was an expected lifecycle boundary when repository-managed tool removal preceded explicit
user-owned config cleanup.
