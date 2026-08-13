# Pi extension methods cross opaque host capability boundaries

## Symptom

The semantic readonly rule reported unresolved effects for Pi extension calls such as:

```text
pi.on
pi.appendEntry
pi.registerCommand
pi.registerShortcut
pi.registerTool
ctx.ui.notify
ctx.ui.select
ctx.ui.setStatus
ctx.ui.setWidget
ctx.sessionManager.getBranch
ctx.modelRegistry.getApiKeyAndHeaders
ctx.abort
```

These calls do not assign a new value to `pi` or `ctx`.
They can still change state held by the Pi runtime,
retain callbacks,
invoke supplied behavior,
or update caches behind those capabilities.

## Installed implementation evidence

The installed `@earendil-works/pi-coding-agent` version is `0.82.0`.
Its declarations expose `ExtensionAPI` and `ExtensionContext` as interfaces in
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.
Those declarations describe type shape but contain no executable bodies.

The runtime implementation is distributed across private factories and runtime classes.
For example,
`dist/core/extensions/loader.js` creates the extension API object and implements registration methods by updating
extension maps or delegating to active runtime services.
`SessionManager.getBranch`,
UI operations,
model-registry authentication,
and cancellation live in other runtime modules.

The shipped JavaScript has adjacent source maps.
`dist/core/extensions/loader.js.map` identifies `src/core/extensions/loader.ts` and embeds its source text.
That evidence is sufficient to inspect the private factory,
but it does not provide a direct exported runtime callable corresponding to the public `ExtensionAPI` interface method.
The method closes over private `extension` and `runtime` state rather than receiving that state as ordinary parameters.

## Why source-map inference stops here

`prefer-readonly-parameter-type` first resolves locked package exports and analyzes exact shipped implementations.
This succeeds for directly exported Pi AI provider callables.
It fails closed for Pi extension interface methods because all of these conditions hold:

- selected declaration belongs to bodyless public interface;
- declaration owner is a type-only export;
- executable method is nested inside private factory return object;
- method effects reach captured private state represented by receiver capability;
- no exact exported callable identity connects interface member to private closure method.

A local wrapper does not improve proof.
The wrapper still calls the same bodyless interface method and only relocates the unresolved receiver.
A class,
global,
or closure that stores the capability hides provenance without proving effects.

Full contextual factory inference would need to prove interface return type,
returned object member identity,
captured variable ownership,
and every transitive runtime call.
The analyzer does not claim that proof when any link is absent.

## Resolution

Source and source-map implementation inference remains first.
When it cannot resolve exact runtime implementation,
callers may use `ForeignHostCapability<T>` from
`@monochromatic-dev/ownership-marker-foreign-borrowed/ts`.

The marker is accepted only through its exact project-owned declaration identity.
A same-named local alias remains opaque.
Optional unions are traversed by semantic type identity,
so `ForeignHostCapability<AbortSignal> | undefined` retains exact authority without string matching.

An unresolved effect reaches acceptance only when both conditions hold:

- affected parameter contains exact `ForeignHostCapability` marker;
- callable has corresponding `@mutates` contract.

Example:

```ts
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Registers extension behavior.
 *
 * @param pi - Pi-owned extension capability.
 *
 * @mutates pi - Registration updates host-owned extension state.
 */
function register(
  pi: ForeignHostCapability<ExtensionAPI>,
): void {
  pi.on('agent_start', handleAgentStart,);
}
```

`ForeignHostCapability<T>` also carries ordinary foreign ownership.
It does not make an unmarked argument safe,
weaken package implementation inference,
or add package and method names to analyzer.

Native `AbortSignal.any` uses the same fallback because TypeScript default-library declarations provide no inspectable
host implementation.
`structuredReviewSignal` marks only caller-provided signal as host capability and documents possible dependent-signal
retention.

## Static provider imports

Reviewer dispatch uses static imports of Pi AI `.lazy` provider modules.
There is no authored runtime `import()` in model-review provider dispatch.
The `.lazy` modules preserve Pi AI optional-provider loading behavior without forcing every provider SDK to be installed
when model-review module loads.

Auto-mode `/guard` handling also statically imports `getTrustDirectives`.
The built auto-mode artifact no longer emits Rolldown's ineffective dynamic-import warning.

## Verification

The following checks pass:

```text
mise run //package/oxlint-plugin/prefer-readonly-parameter-type:lint:types
mise run //package/oxlint-plugin/prefer-readonly-parameter-type:lint:oxlint
mise run //package/oxlint-plugin/prefer-readonly-parameter-type:test:unit
mise run //package/ownership-marker/foreign-borrowed:lint:types
mise run //package/ownership-marker/foreign-borrowed:lint:oxlint
mise run //package/pi-shared/model-review:build
mise run //package/pi-shared/model-review:lint:types
mise run //package/pi-shared/model-review:lint:oxlint
mise run //package/pi-shared/model-review:test:unit
mise run //package/pi-plugin/auto-mode:build
mise run //package/pi-plugin/auto-mode:lint:types
mise run //package/pi-plugin/auto-mode:lint:oxlint
mise run //package/pi-plugin/auto-mode:test:unit
mise run //package/pi-plugin/goal:build
mise run //package/pi-plugin/goal:lint:types
mise run //package/pi-plugin/goal:test:unit
```

Auto-mode and model-review Oxlint each report zero warnings and zero errors.
The rule tests prove exact marker acceptance,
missing-contract rejection,
same-named alias rejection,
optional-union recognition,
and catalog-free architecture.

## What does not work

- `ReadonlyDeep<ExtensionAPI>` keeps mutating methods and makes a unsupported immutability claim.
- `ForeignBorrowed<ExtensionAPI>` records ownership but does not authorize unresolved behavior.
- Local wrappers only move the bodyless call.
- Global,
  class,
  or closure capability retention hides provenance without proof.
- Method-name or package-name effect tables become handwritten authorities and drift from installed implementation.
- `@mutates` alone documents a claim but cannot authorize unresolved implementation.
- Treating all host methods as observational misses registration,
  UI,
  cancellation,
  and command-backed authentication effects.
- Treating all methods as mutating without explicit boundary authority weakens fail-closed analysis globally.

## Upstream filing decision

No Pi defect was found.
The runtime methods behave as host capabilities are expected to behave.
The mismatch is between bodyless public declarations and repository ownership proof requirements,
so the resolution belongs in project marker and analyzer policy rather than an upstream behavior change.
