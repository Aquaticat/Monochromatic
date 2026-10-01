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
The intended authentication routes and default-selection policy remain open.

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

### Authentication coverage

Should the initial extension target the existing Codex login,
 an OpenAI API key,
 or both routes?

Recommendation:
start with the existing Codex workflow,
 subject to verification that its transport supports the intended request behavior.
This follows the observed enabled-model scope without adding an unrequested authentication route.

### Default selection

Should companion models remain opt-in without changing defaults,
 or should installation also select a fast companion as the default?

Recommendation:
leave existing defaults unchanged.
Model aliases and default selection are separate concerns.

### Delivery scope

Should completion include global installation and replacement of the incumbent fast extension,
 or only a package in this repository?

Recommendation:
build and verify the repository package,
 then install globally and replace the incumbent only after its behavior and migration implications are established.

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

Ask the independent preference questions while research runs.
Use verified findings to form the next interview frontier.
Do not implement,
 change installed packages,
 or change defaults before the user confirms the complete design.
