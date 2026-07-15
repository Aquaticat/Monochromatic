# Remove retired hk Git configuration

## What this proves

The repository-owned bridge is `mise run cleanup:hk-git-config`.
It replaces manual Git-config editing and does not require the retired hk or Pkl tools.
The implementation lists effective Git configuration,
selects only keys beginning with `hook.hk-`,
and removes them from explicitly requested local or global scopes.
Automated verification uses disposable repository and global-config files because issue `#357` forbids changing real
per-user Git state during tests.

## Setup

Status:
TODO | DONE

1. Open a terminal in a current Monochromatic checkout and run `git rev-parse --show-toplevel`.
   Expect the command to print the checkout root ending in `Monochromatic`.
2. Run `mise run prepare:pnpm:install`.
   Expect pnpm to finish without an error so the typed cleanup command can resolve its workspace dependencies.
3. Run `git config --show-scope --show-origin --get-regexp '^hook\.hk-'`.
   Expect zero or more lines whose key begins with `hook.hk-`;
   exit code `1` with no output means this machine already has no retired registration.
4. Save any printed lines outside the repository if local policy requires a rollback record.
   Expect the saved record to contain scope,
   origin,
   key,
   and value for every retired registration.

## Steps

Status:
TODO | DONE

1. Run `mise run //packages/git-policy/cli:test:hk-config-cleanup`.
   Expect logs for unconfigured,
   configured,
   repeated,
   local,
   and global cleanup with no error;
   all mutations occur under a disposable temporary directory.
2. Run `mise run cleanup:hk-git-config -- --local --global`.
   Expect the terminal output to end with one compact JSON object containing `"schemaVersion":1` and separate `local`
   and `global` results.
   Each `removedKeys` array contains only `hook.hk-*` names or is empty.
3. Run the same cleanup command again.
   Expect both `removedKeys` arrays to be empty,
   which proves idempotence on this machine.

## What to check

Status:
TODO | DONE

Run:

```sh
git config --show-scope --show-origin --get-regexp '^hook\.hk-'
```

Expect no output and exit code `1`.
Do not remove other `hook.*` keys:
the cleanup owns only the exact `hook.hk-` prefix.
Normal cli-git policy enforcement remains active because native `--no-verify` skips Git hooks but does not skip
cli-git policies.

## Restore

Status:
TODO | DONE

The disposable verification removes its temporary repository and global config automatically.
The real cleanup is the intended migration state and should not be restored.
If it was run on the wrong checkout or account,
use the scope,
key,
and value captured during `Setup` to restore only those recorded entries with
`git config --local --replace-all <key> <value>` or `git config --global --replace-all <key> <value>`.
Then rerun the `What to check` command and expect only the deliberately restored `hook.hk-*` entries.
