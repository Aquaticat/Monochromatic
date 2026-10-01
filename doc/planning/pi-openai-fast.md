# Pi OpenAI fast extension design interview

## Status

Design interview requested with `/grill-me`.
Implementation is not authorized until the user confirms shared understanding.
This document tracks requirements and open decisions;
 it is not an accepted architecture decision.

## Requested behavior

- Create a pi extension for OpenAI fast selection.
- Send the priority service tier.
- Use virtual models.
- Correct misunderstandings about pi before implementing.

Virtual models mean pi's native `pi.registerVirtualModel()` entries,
 not just a physical provider with companion model IDs.
Each selection ultimately uses an existing upstream Codex model ID.
The user accepted Codex-login-only authentication,
 opt-in fast companions,
 and global replacement of the incumbent extension after verification.

## Existing environment

Read-only inspection of the global `~/.pi/agent/settings.json` found:

- `npm:pi-openai-codex-fast` is already installed.
- The enabled model scope includes `openai-codex/gpt-6-sol`,
   `openai-codex/gpt-6-luna`,
   and `openai-codex/gpt-6-astra`.
- The configured transport is `auto`.
- Local pi-plugin packages are installed by their repository paths.

The project [pi settings README](../../.pi/README.md) reserves user-specific workflow packages
for global settings rather than project settings.
The installed pi documentation inspected for initial context reports version `0.99.2`.

An unrelated modification to `pnpm-lock.yaml` existed before this work.
Do not stage or modify it as part of the design interview.

## Work areas

- Provider and virtual-model registration:
   investigate pi documentation,
   installed types,
   authentication reuse,
   request translation,
   and transport preservation.
- Priority service semantics:
   investigate current OpenAI documentation and the installed fast extension.
- User-facing selection and installation:
   settle preferences through the design interview.

Read-only research completed in separate evidence notes:
[provider research](pi-openai-fast-provider-research.md)
and [service research](pi-openai-fast-service-research.md).
The main agent inspected the incumbent source and relevant native types and implementations,
 corrected physical-versus-virtual terminology,
 and ran disposable fixture probes.

## Interview frontier

### Accepted round-one answers

The user answered `Q1 A`,
 `Q2 A`,
 and `Q3 A`.

- Authentication:
   reuse the existing Codex login;
   OpenAI API-key support is out of scope for the initial extension.
- Defaults:
   fast companion models remain opt-in;
   preserve ordinary model entries and the existing default model.
- Delivery:
   build and verify the repository package,
   then install it globally and replace `pi-openai-codex-fast`.
   Check migration implications and competing hooks before replacement.

These answers settle requirements,
 not the complete implementation design.
The user has not yet confirmed shared understanding of that complete design.

### Accepted round-two answers

The user answered `Q4 A` and `Q5 A`,
 with a correction to the registration proposal.

- Leave `enabledModels` unchanged during installation.
- Register fast companions for every base Codex model pi registers,
   independently of personal scope.
- Do not manually maintain a compatibility list or filter companions by declared priority support.
- Treat fast support as a request-time assumption,
   not a verified statement that every backend model accepts priority.
- The user considers selecting an incompatible model in fast mode a user error.
  Surface the backend rejection rather than silently selecting a different model or ordinary tier.

The initial recommendation's word "compatible" is superseded:
there is no manually curated priority-capability gate.
Registering a companion does not authorize scope widening or establish backend support.

### Accepted selection-feedback answer

The user answered Q6:
"Don't need any."

Do not add selection indicators,
 footer widgets,
 request-status notifications,
 or a served-tier reporting UI.
The virtual models still need distinct selectable identities,
 but no additional feedback feature is requested.
Normal internal logging requirements remain in effect.

## Local selection evidence

`package/pi-shared/model-selection/src/scope-patterns.ts` resolves scope by model identity.
A disposable fixture probe called the real `resolveModelPatterns()` implementation:

- Positive control:
   `openai-codex/gpt-6-sol*` selected the ordinary fixture and its `-fast` companion.
- Existing exact entry:
   `openai-codex/gpt-6-sol` selected only the ordinary fixture.

The probe also called the real `scoreModelSpeed()` from
`package/pi-shared/model-selection/src/speed-signals.ts`.
The ordinary fixture scored `0`;
 the fixture with a `-fast` suffix and `Fast` display-name suffix scored `90`.
These scores are local name heuristics,
 not measured backend speed.
`package/pi-plugin/auto-mode/src/budget-model.ts` uses that scoring to sort eligible automatic judge candidates.

The first-round wording that opt-in always requires explicit selection was incomplete:
preserving the default model alone does not prevent automatic auxiliary selection.
Scope inclusion and auxiliary-selection eligibility must also be considered.
No aliases have been implemented or added to the user's scope.

Independent Advisor review identified the same boundary and highlighted session migration,
 transport preservation,
 authentication refresh,
 and requested-versus-served tier observability.

## Verified pi distinctions

The incumbent `pi-openai-codex-fast@0.0.17` registers physical companions,
 not native virtual models,
 and uses a manually maintained allowlist.
Native virtual routing returns physical model,
 thinking level,
 and optional state;
 it has no request-options return channel.
Pi resolves the physical target from the catalog and discards changes to a cloned route target.

A disposable `ModelRuntime` fixture verified:

- A genuine virtual selection has API `pi-virtual`.
- A physical routing target can be omitted from `getAvailable()` through a native provider filter,
   while a virtual entry remains available and routes to it.
- A cloned target's changed API and an extra route `serviceTier` value do not reach the resolved request.

A second probe invoked the real native Codex adapter,
 with synthetic authentication and a payload callback that stopped before networking.
The full native stream constructed `service_tier: "priority"`.
Native `streamSimple` discarded an extra top-level `serviceTier` value during option conversion.
The exported `buildBaseOptions()` preserved the abort signal,
 `transport: "auto"`,
 and session ID.
These are offline construction and routing probes,
 not a completed extension or live backend verification.

## Proposed implementation awaiting confirmation

- Register genuine virtual entries using the incumbent
   `openai-codex-fast/<base-model-id>` identities to preserve existing selections.
- Enumerate every registered base Codex model without a priority compatibility list.
- Route fast entries through internal physical priority targets that are excluded from availability lists.
- Keep ordinary Codex model entries,
   OAuth ownership,
   configuration overrides,
   catalog refresh,
   and ordinary streaming behavior intact.
- Translate internal targets back to the live upstream base identity before native streaming.
- Reuse the native simple-option conversion helper and reasoning mapping,
   then call native Codex streaming with priority request options.
   Preserve asynchronous payload callbacks,
   callback replacement payloads,
   response instrumentation,
   cancellation,
   timeouts,
   retries,
   cache behavior,
   headers,
   environment,
   and transport selection.
- Preserve canonical base-model assistant history while pi persists the virtual selection separately.
- Preserve defaults and `enabledModels`.
- Add no extension-authored feedback UI.
  Pi's normal model display and virtual-routing presentation remain host behavior.
- Build the package at `package/pi-plugin/openai-fast`,
   verify it through the host,
   then replace the incumbent globally without loading conflicting physical and virtual identities together.

The filter probe establishes availability-list exclusion,
 not invisibility in every registry API or host display.
Provider composition,
 OAuth reuse,
 request dispatch,
 refresh synchronization,
 session recovery,
 reasoning,
 tool calls,
 accounting,
 and transport behavior need candidate verification.
Independent Advisor review required those checks and warned against global mutable fast-state tagging.

## Backend contract and remaining evidence gaps

The extension's intended guarantee is requesting `service_tier: "priority"`,
 not guaranteed acceleration or confirmed priority execution.
Do not silently fall back to a different model or tier after a rejection.
A server-side outcome is distinct from client fallback.

[OpenAI's Codex speed documentation][codex-speed] documents increased subscription-limit consumption for Fast.
A [pi maintainer comment][pi-fast-comment] questioned Fast effectiveness in non-Codex harnesses.
Neither source establishes this login's current backend behavior through pi.
Actual acceptance,
 served-tier interpretation,
 latency,
 entitlement,
 and quota consumption have not been measured here.
The user does not want a reporting UI or compatibility catalog to manage those uncertainties.

## Verification obligations after confirmation

- Validate startup,
   explicit model selection,
   scope preservation,
   reload,
   catalog changes,
   and incumbent-session migration in disposable host fixtures.
- Show normal requests retain their normal tier path and fast requests use the original model ID plus priority.
- Exercise asynchronous payload replacement,
   reasoning levels,
   tool follow-ups,
   overflow recovery,
   aborts,
   retry controls,
   and native transport delegation.
- Verify OAuth refresh and logout with disposable credentials before touching the real installation.
- Verify canonical history and virtual selection through resume,
   fork,
   branch navigation,
   and extension removal.
- Run scoped package lint,
   type checking,
   tests,
   build,
   and consumer-facing host verification.
- Perform a live Codex smoke request after implementation without claiming that success alone proves acceleration.

## Design-stage verification

The scoped `mise run lint:markdown` command passed for this plan,
 both research notes,
 and [the troubleshooting record](../troubleshooting/pi-virtual-priority-options.md).
Local renderer tests passed for those documents and confirmed that the embedded troubleshooting harnesses
match the executed scratch programs.
The routing and native-adapter fixture tests passed without live inference.

Independent reviews were used to check selection-consent boundaries and the proposed native virtual routing architecture.
No extension source,
 global settings,
 default model,
 or enabled-model scope has been changed.
The pre-existing `pnpm-lock.yaml` modification remains unrelated and unstaged.

## Next action

Ask the user to confirm the complete shared design and request-only backend contract.
Do not implement,
 change installed packages,
 or change defaults before that confirmation.

[codex-speed]: https://developers.openai.com/codex/agent-configuration/speed
[pi-fast-comment]: https://github.com/earendil-works/pi/issues/6738#issuecomment-4995103821
