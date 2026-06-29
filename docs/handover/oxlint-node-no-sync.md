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
- Recorded the upstream prototype patch and verification in `docs/troubleshooting/oxlint-node-no-sync.patch` and committed it as `264548a5b`.
- Added project rule `no-restricted-syntax/no-sync`, fixtures, config wiring, and readonly allowlist updates across follow-up commits through `6ad8bbac0`.

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
- Updated and committed `docs/troubleshooting/oxlint-node-no-sync.md`

Verification command passed:

```bash
cargo test --manifest-path /tmp/agent/oxc-no-sync-prototype-LmG4Snov/Cargo.toml --package oxc_linter node::no_sync::test
```

Prototype doc work is complete.

## Local rule state

Custom rule implementation is present and targeted verification passed.

Changed files:

- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.constants.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.syntax.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.provenance.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.node-builtin-source.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.node-sync-binding.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.node-sync-member.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/index.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`
- `packages/test-fixture/oxlint-no-restricted-syntax/.oxlintrc.fixture.json`
- `packages/test-fixture/oxlint-no-restricted-syntax/src/invalid/no-sync.ts`
- `packages/test-fixture/oxlint-no-restricted-syntax/src/valid/no-sync.ts`
- `packages/config/oxlint/src/rules/restriction.ts`
- `packages/config/oxlint/src/overrides.ts`
- `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts`
- `packages/oxlint-plugins/no-restricted-syntax/README.md`

Policy shape:

- `no-restricted-syntax/no-sync` reports Node builtin sync APIs resolved through imports,
  `require()`,
  `process.getBuiltinModule()`,
  destructuring,
  simple aliases,
  and `.apply()`/`.call()` from a sync member.
- Shared oxlint config disables upstream `node/no-sync` and enables the project rule.
- Existing `parseSync` callsites are untouched.

## Verification completed

Passed:

```bash
mise run //packages/oxlint-plugins/no-restricted-syntax:format:oxlint
mise run //packages/oxlint-plugins/no-restricted-syntax:lint:oxlint
mise run //packages/oxlint-plugins/no-restricted-syntax:lint:types
mise run //packages/oxlint-plugins/no-restricted-syntax:build
mise run //packages/oxlint-plugins/no-restricted-syntax:test:unit
mise run //packages/config/oxlint:lint:oxlint
mise run //packages/config/oxlint:lint:types
```

Boundary check:

```bash
mise run //packages/cli/git:lint:oxlint
```

This now reports zero warnings and no `parseSync` findings.
It still fails on two unrelated existing `catch-binding` errors in `packages/cli/git`.

Dirty unrelated files left for caller awareness:

- `mise.lock` has a CMake `4.3.3` to `4.3.4` update from mise tool resolution.
- `docs/troubleshooting/pnpm-modules-cache.md` exists untracked and was not created for this task.
