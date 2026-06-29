# Oxlint node/no-sync handover

## Current request

User wants two outcomes:

- A troubleshooting doc focused on oxlint `node/no-sync` flagging Optique `parseSync`.
- A custom `no-restricted-syntax/no-sync` rule that bans only sync APIs for constructs that are inherently async but exposed as sync APIs.
  For now this includes only Node sync methods.

User explicitly said not to fix existing code,
so do not change the current `parseSync` callsites in `packages/cli/git/src/parsers/`.

## Work completed

- Created `docs/troubleshooting/oxlint-node-no-sync.md`.
- Committed it as `4df2be188` with message `docs(oxlint): document node no-sync suffix false positive`.

## Prototype state

User pointed out that troubleshooting-doc constraints sorta-hold,
so the auto-prototype step had to run.
That is now done.

Fresh disposable upstream clone:

```text
/tmp/agent/oxc-no-sync-prototype-LmG4Snov
```

Origin and commit:

```text
https://github.com/oxc-project/oxc.git
d8c6b550c8802cc68f8e404f279cdc603692b3b6
```

Prototype artifacts:

- `docs/troubleshooting/oxlint-node-no-sync.patch`
- Updated but not yet committed `docs/troubleshooting/oxlint-node-no-sync.md`

Verification command passed:

```bash
cargo test --manifest-path /tmp/agent/oxc-no-sync-prototype-LmG4Snov/Cargo.toml --package oxc_linter node::no_sync::test
```

Next step:
commit the troubleshooting doc and patch update.

## Local rule plan

After the troubleshooting doc is corrected:

- Add a new rule file under `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.ts`.
- Register `no-sync` in `packages/oxlint-plugins/no-restricted-syntax/src/index.ts`.
- Enable it in fixture config and shared oxlint restriction rules.
- Disable upstream `node/no-sync` in shared restriction rules so the custom rule owns the policy.
- Add invalid and valid fixture coverage.
- Do not alter existing `parseSync` usages.

## Verification reminders

Use mise tasks only.
Likely relevant commands:

```bash
mise run //packages/oxlint-plugins/no-restricted-syntax:build
mise run //packages/oxlint-plugins/no-restricted-syntax:test:unit
mise run //packages/oxlint-plugins/no-restricted-syntax:lint:types
mise run //packages/config/oxlint:lint:types
```

`mise run //packages/cli/git:lint:oxlint` currently has unrelated existing `catch-binding` errors,
so it is useful for observing the old false-positive shape but not a clean final verification target unless those external errors are separately addressed.
