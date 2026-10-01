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

The working interpretation of virtual models is selectable companion entries
that map to existing upstream model IDs rather than new upstream models.
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

Read-only research agents are writing separate evidence notes:
[provider research](pi-openai-fast-provider-research.md)
and [service research](pi-openai-fast-service-research.md).
Those notes are pending and do not yet establish capabilities.

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

## Unsettled factual prerequisites

- Whether the installed fast extension already implements virtual models.
- Whether pi has a suitable shared transport hook without reimplementing streaming.
- How alias IDs preserve authentication,
   capabilities,
   session identity,
   reasoning support,
   and auxiliary-call selection.
- Which priority semantics are documented for each authentication route.
- Whether the requested tier can differ from the served tier and whether pi exposes that difference.

## Next action

Await the pending research notifications without polling.
Use verified findings to form the next interview frontier,
 including model identity,
 model coverage,
 priority failure behavior,
 and the meaning of opt-in for auxiliary calls.
Do not silently widen `enabledModels` as an installation convenience.
Do not implement,
 change installed packages,
 or change defaults before the user confirms the complete design.
