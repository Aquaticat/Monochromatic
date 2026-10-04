# Sandbox restorer scope for issue 582

## Status

Confirmed resolution plan for [issue 582](https://github.com/Aquaticat/Monochromatic/issues/582).
The user confirmed the scope-only change after the grilling round.
The implementation moves the callback declaration without changing its body or execution order.
The first rebuilt-artifact unit run passed.
Lint confirmed removal of the scope warning but reported `stylistic(max-statements-per-line)`
on the moved one-line declaration.
The declaration body now occupies its own line; final verification is pending.
No design questions remain open.

## Evidence

`mise run //package/module/test:lint` exits with status 1.
Oxlint reports one warning and no errors across 68 files:
`unicorn(consistent-function-scoping)` at `package/module/test/src/sandbox.ts:89:16`.
The named callback `restoreOrdinarySandbox` contains only `raw.restore()`.
Its captured `raw` belongs to `createOwnedSandbox`, not to `restore`.

`package/module/test/src/sandbox-cleanup.ts` invokes each supplied callback
and aggregates restoration failures.
`package/module/test/src/sinon-cleanup.unit.test.ts` exercises automatic restoration,
manual restoration and restubbing, completed-attempt guards, and combined body/cleanup failures
through the public artifact.

## Confirmed change

Move the named function declaration into `createOwnedSandbox`, immediately before `restore`.
Pass `restoreOrdinarySandbox` as the final callback after the lease callbacks.
Keep the `raw.restore()` method call, cleanup authority window, error aggregation,
and public interface unchanged.
Do not change `restoreSandboxSteps` or its signature.

The recommendation is this scope-only change rather than a broader lifecycle refactor:
it directly addresses the diagnostic without introducing a new cleanup design.
Lint suppression is excluded because the declaration can inhabit its captured binding's scope.
The review risk is accidentally changing the receiver or callback execution order;
the patch must preserve both explicitly.

## Verification and completion

Completion checklist:

- Commit the scoped implementation change with the issue reference.
- Run package lint, including `lint:types`, and require no warnings or errors.
- Rebuild the package and run its unit tests against fresh built artifacts.
- Inspect cleanup test results and the final diff; leave unrelated concurrent work untouched.
- Record results and verify that the issue closes after the fix reaches the default branch.

Browser execution is not included in this proposed scope.
A runtime-specific failure would require revisiting that boundary.
