# Pi dynamic workflows replacement vet report

## Audit metadata

- Status: in progress
- Lifecycle phase: context measured; rubric freeze pending
- Subject: `pi-dynamic-workflows` replacement for `@narumitw/pi-subagents`
- Scope: evaluate whether `@quintinshaw/pi-dynamic-workflows` is safe and suitable to replace the installed
  `@narumitw/pi-subagents` Pi extension.
- Start date: 2026-07-10
- Last updated: 2026-07-10
- Governing skill commit: `3b6d1bd6ac0c6eb5704152ddb00e2b69ddcf653b`
- Governing skill SHA-256: `71c50a51d0f0086f789e350ef43824f8aead66435f9ab92d94aae751d16d8359`
- Compatibility fingerprint:
  `d6adb5e5bf6999a490f5b116b145b3fa4318ef611f18bf3d9cad01ff445299f2`
- Active audit owner: current Pi session; harness does not expose a stable session identifier
- Prior compatible report: none found under `docs/audit/`; the related
  `docs/handover/subagent-extension-audit.md` predates this candidate-specific report and does not carry a compatibility
  fingerprint.

## Compatibility fingerprint input

```json
{"baseCategories":["inspectable open-source local technology"],"decisionScope":"Evaluate whether @quintinshaw/pi-dynamic-workflows is safe and suitable to replace the installed @narumitw/pi-subagents Pi extension.","deployment":{"architecture":"x86_64","operatingSystem":"Linux","piVersion":"0.80.6","runtime":"Node 26.5.0"},"hardConstraints":["Complete observable child prompts, progress, tool calls, outputs, status, and errors in user-facing UI","Inspectable open-source execution path with compatible license and mapped build provenance","No ambient credentials or unbounded third-party execution during validation","Parent-set per-subagent timeout including parallel children","Read-only subagent capability enforced by explicit tool allowlist without ambient extensions","Runs on installed Pi 0.80.6 with Node 26.5.0 on Linux x86_64","User can interrupt every running foreground, parallel, and background child from the UI"],"incumbentName":"@narumitw/pi-subagents","incumbentVersion":"0.13.0","overlays":["high-trust execution in an agent extension","human auditability","incumbent dependency replacement"],"schemaVersion":1,"subject":"pi-dynamic-workflows replacement for @narumitw/pi-subagents","trustBoundary":"High-trust Pi extension that launches model agents with repository, filesystem, process, network, and credential-adjacent access."}
```

The fingerprint input uses NFC strings, sorted set-valued arrays, recursively sorted deployment keys, JSON canonical
serialization, and SHA-256 over the exact UTF-8 bytes.

## Context

### Measured deployment

- `/var/home/user/.pi/agent/settings.json` loads `npm:@narumitw/pi-subagents` globally.
- The installed manifest at
  `/var/home/user/.pi/agent/npm/node_modules/@narumitw/pi-subagents/package.json` identifies version `0.13.0`, MIT
  licensing, one runtime dependency on `typebox`, and source repository
  https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-subagents.
- The running host reports Pi `0.80.6`, Node `26.5.0`, Linux, and `x86_64`.
- The project-level `.pi/settings.json` deliberately contains no package list, so the replacement concerns the global Pi
  workflow rather than project configuration.
- The installed incumbent contains `1,980` physical lines across its TypeScript files, measured with `wc --lines`.
  Code-only size and cloned-source parity remain pending.

### Prior settled requirements

The related audit handover at `docs/handover/subagent-extension-audit.md` records requirements that remain applicable to
this replacement request:

- observable child prompts, progress, tool calls, outputs, status, and errors;
- user interruption for foreground, parallel, and background children;
- parent-selected timeout per child;
- a read-only capability profile;
- source, test, CI, dependency, maintenance, and integration inspection.

The current request names a replacement rather than reopening those requirements, so this audit carries them forward
instead of asking a rubber-stamp question.

### Component classification

- `@narumitw/pi-subagents`: inspectable open-source local technology.
- `@quintinshaw/pi-dynamic-workflows`: inspectable open-source local technology, pending source and artifact provenance
  confirmation.
- Active overlays: incumbent dependency replacement, high-trust agent execution, and human auditability.
- Managed service gate: not applicable because neither compared component is a hosted control plane.
- SaaS historical and operational gates: not applicable for the same reason.
- Proprietary local technology gate: not applicable because both named components publish source under an asserted MIT
  license; the license text and package-source parity still require confirmation.
- Sensitive-data compliance overlay: not separately active because the request sets no residency, retention, or regulated
  data requirement. Credential-adjacent execution remains covered by the high-trust overlay.
- Multi-platform overlay: not active as a hard requirement because the measured deployment is Linux `x86_64`. Any broader
  platform claim made by a finalist will still be checked before receiving score credit.
- Native, Wasm, generated-code, and prebuilt overlays: pending dependency and release-artifact inspection.

## Hard constraints

- Complete observable child prompts, progress, tool calls, outputs, status, and errors in user-facing UI.
- User interruption of every running foreground, parallel, and background child from the UI.
- Parent-set per-subagent timeout, including parallel children.
- Read-only subagent capability enforced by an explicit tool allowlist without ambient extensions.
- Inspectable open-source execution path with compatible license and mapped build provenance.
- Successful execution on installed Pi `0.80.6` with Node `26.5.0` on Linux `x86_64`.
- No ambient credentials or unbounded third-party execution during validation.

## Initial candidate ledger

### `@narumitw/pi-subagents` `0.13.0`

- Discovery source: installed global Pi package and local package lock.
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement baseline, high-trust agent execution, human auditability.
- Screening result: pending targeted parity audit; retained because replacement parity requires keeping the incumbent.

### `@quintinshaw/pi-dynamic-workflows` `2.12.1`

- Discovery source: user-named candidate; official repository
  https://github.com/QuintinShaw/pi-dynamic-workflows and npm registry record
  https://registry.npmjs.org/@quintinshaw%2Fpi-dynamic-workflows/latest.
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement candidate, high-trust agent execution, human auditability; native, Wasm, generated, and
  prebuilt status pending.
- Screening result: serious alternative pending hard-gate confirmation. The npm registry reports version `2.12.1`, MIT,
  one runtime dependency on `acorn`, and `100` published files. These are discovery facts, not trust evidence.

### Other alternatives

The prior handover records multiple open-source Pi subagent extensions and a minimal custom design. The frozen discovery
schedule will determine which remain category-fit alternatives for this narrower direct-replacement decision. No custom
implementation can be recommended unless every ready-to-use technology fails a named hard constraint.

## Preliminary evidence limits

- Repository and registry descriptions are promotional or metadata evidence. They do not establish behavior, provenance,
  safety, maintenance quality, or replacement parity.
- The GitHub page currently shows `121` stars, `38` forks, `84` commits, `34` tags, and release `2.12.1` dated 2026-07-10 at
  https://github.com/QuintinShaw/pi-dynamic-workflows. These counts are low-signal discovery context only.
- No candidate recommendation is made at this phase.

## Frozen criteria and weights

Pending context completion and rubric freeze. Candidate-specific soft evidence will not be rated before this section is
frozen.

## Query schedule and discovery ledger

Pending literal schedule freeze and source-class saturation.

## Evidence records

Pending targeted audits.

## Execution manifests

No third-party command tree has been executed for this report. Clone operations will use `/tmp/agent/`; any install, build,
test, or runtime execution will receive a manifest first.

## Hard-gate exits

None yet.

## Validation results

Pending.

## Score arithmetic and sensitivity

Pending validated finalists.

## Pros, cons, ranking, and recommendation

Pending completion of every applicable gate. Recommendation is deliberately withheld.
