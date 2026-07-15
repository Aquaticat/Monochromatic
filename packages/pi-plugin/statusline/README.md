# pi-statusline

Pi extension that adds one footer status for provider usage pressure.

It uses the shared usage-projection formatter also used by
`packages/claude-code-plugin/statusline`:
warnings render when remaining capacity is low or projected burn rate exceeds the window.

## What it displays

Comfortable usage with sustainable burn rate renders nothing.
No news is good news.

Low remaining capacity renders remaining percentage and reset time:

```text
codex 5h 18% left (4h)
```

Projected overflow appends the extrapolated end-of-window usage:

```text
codex 5h 60% left →150% (4h)
```

The `→150%` marker means current used percentage,
elapsed window time,
and reset time imply that
continued burn rate will exceed available capacity before the limiter replenishes.

Multiple constrained windows are joined with a centered dot:

```text
anthropic tokens 60% left →120% (40s) · synthetic search 8% left (30m)
```

## Supported sources

Pi exposes provider response headers through the `after_provider_response` event.
The extension reads projectable usage windows from these sources:

- Anthropic token limit headers,
   such as `anthropic-ratelimit-tokens-limit`,
  `anthropic-ratelimit-tokens-remaining`,
   and `anthropic-ratelimit-tokens-reset`.
- OpenAI Codex subscription headers,
   matching Codex CLI's `x-codex-primary-used-percent`,
  `x-codex-primary-window-minutes`,
   and `x-codex-primary-reset-at` families.
- Synthetic.
  new quota headers from `@aliou/pi-synthetic`,
   via `x-synthetic-quotas`.

The extension skips quota windows that do not expose enough data for projection.
For Synthetic.
new,
 that means `rollingFiveHourLimit` and legacy `subscription` data are ignored because
`@aliou/pi-synthetic` does not model them as pace-projectable windows.

## Colors

Provider usage pressure uses Pi theme colors:

- `success` when more than 25% remains.
- `warning` when 10% to 25% remains.
- `error` when 10% or less remains,
  or when projection exceeds 100%.

## Installation

Add the package to Pi settings:

```json
{
  "packages": ["./packages/pi-plugin/statusline"]
}
```

For local testing without installation:

```bash
pi --extension ./packages/pi-plugin/statusline/src/index.ts
```

## Scope

This package intentionally does not port the rest of the Claude Code statusline.
It does not show model names,
 effort levels,
 activity words,
 context-window counters,
 or generic footer replacements.
