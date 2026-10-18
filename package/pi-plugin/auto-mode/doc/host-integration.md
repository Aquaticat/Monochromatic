# Host integration

## Purpose and interface

`native/contract/integration/native-host/bootstrap.ts` binds one configured Pi session
to `bindNativePolicyRuntime` in `native/contract/integration/native-batch/runtime.mjs`.
The runtime installs complete-group review before tool execution,
connects original request observation,
and returns inspection and detachment operations to the session owner.

The host is needed because independent extension tool callbacks do not provide this package's
original complete-group preparation and execution lifetime.
The qualified upstream transformation adds that execution seam while retaining Pi's actual tools,
extensions,
resource loader,
and model stream.

## Ownership and invariants

The original session and agent remain the execution owners.
The runtime binds only while idle and refuses an already occupied complete-group executor.
`src/native-runtime-hooks.ts` owns slot installation,
rollback,
and removal.
`src/native-query-observation.ts` preserves the observed original request.
Neither hook installation nor observing a request grants permission.

`native/contract/lifecycle/root-lifecycle-retirement-entry` connects observation to session retirement.
`native/contract/lifecycle/runtime-factory-scopes` retains constructor and cleanup ownership.
These lifetime checks prevent an answer for a disposed or replaced session from authorizing a later operation.
Their decomposition remains a consolidation target;
the responsibility is needed even if the current internal arrangement changes.

## Dependencies and alternatives

Pi is a third-party dependency.
The build transforms a qualified source copy rather than editing the installed dependency.
Tests use the same built host with disposable sessions and controlled provider responses.

Keeping the superseded extension flagger would introduce another approval path with different semantics.
It is removed from the maintained entry and package extension metadata.
The native command remains the execution path.

## Verification

`test:native:constructor`,
`test:native:host-lifecycle`,
and `test:native:dependency-facade` exercise construction,
disposal,
and maintained-export identity.
`test:native:decision-fallback` crosses the actual group hook.
The final consumer replay also loads configured extensions,
skills,
and tool catalogs through the installed command.

Task names use `mise run //package/pi-plugin/auto-mode:<task>`.
