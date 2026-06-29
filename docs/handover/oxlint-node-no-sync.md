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

## Current correction

User pointed out that troubleshooting-doc constraints sorta-hold,
so the auto-prototype step must run.
The committed troubleshooting doc currently says no prototype was run.
That must be corrected after the prototype.

## Prototype state

Fresh disposable upstream clone was created for the auto-prototype:

```text
/tmp/agent/oxc-no-sync-prototype-LmG4Snov
```

Clone command used:

```bash
gh repo clone oxc-project/oxc /tmp/agent/oxc-no-sync-prototype-LmG4Snov -- --depth 1
```

Next steps:

- Verify clone origin and commit.
- Prototype the smallest upstream-compatible change that prevents `parseSync()` imported from `@optique/core/parser` from triggering `node/no-sync`, while keeping Node sync APIs reported.
- Record the patch and verification in `docs/troubleshooting/oxlint-node-no-sync.md`.
- Commit the troubleshooting doc update.

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

`mise run //packages/cli/git:lint:oxlint` currently has unrelated existing `no-optional-catch-binding` errors,
so it is useful for observing the old false-positive shape but not a clean final verification target unless those external errors are separately addressed.
