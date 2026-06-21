# @monochromatic-dev/pi-shared-model-selection

Shared model-selection logic for pi plugins.

This package lives under `packages/pi-shared/` because it is reusable pi extension infrastructure,
not a pi extension itself. Packages in this category must be intended for at least two pi packages
and expose APIs that make sense outside one extension command, renderer, or config surface.
Actual pi extensions stay under `packages/pi/`.

## Export tiers

The package uses subpath exports so lightweight consumers can import string and type helpers
without loading platform-coupled modules.

- `@monochromatic-dev/pi-shared-model-selection` and `/core` export dependency-free helpers and types.
- `/scope` exports scope pattern, settings, and effective-scope helpers.
- `/cost` exports cost scoring and ranking helpers.
- `/budget` exports fast judge-model strategy and override selection helpers with injected auth callbacks.
- `/pi-coding-agent` exports wrappers that directly import `@earendil-works/pi-coding-agent`.

`@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` are optional peer dependencies.
Root and `/core` modules must not import either peer.

## Consumer boundaries

Advisor and auto-mode can import heavier `/scope`, `/cost`, `/budget`, and `/pi-coding-agent` modules.
Thinking-defaults imports only root or `/core` helpers.
