# pi-statusline

Pi extension that adds one footer status:
 projected provider usage overflow warnings.

It ports only the projected-overflow warning behavior from `packages/claude-code-plugins/statusline`.
Comfortable usage and low remaining capacity render nothing.

## What it displays

No projected overflow renders nothing.
No news is good news.

Projected overflow renders the extrapolated end-of-window usage:

```text
codex 5h →150% (4h)
```

The `→150%` marker means current used percentage,
 elapsed window time,
 and reset time imply that
continued burn rate will exceed available capacity before the limiter replenishes.

Multiple overflowing windows are joined with a centered dot:

```text
anthropic tokens →120% (40s) · synthetic search →120% (30m)
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
It does not show status for low remaining capacity by itself.

## Colors

Projected overflow uses Pi theme `error` color.

## Installation

Add the package to Pi settings:

```json
{
  "packages": ["./packages/pi-plugins/statusline"]
}
```

For local testing without installation:

```bash
pi --extension ./packages/pi-plugins/statusline/src/index.ts
```

## Scope

This package intentionally does not port the rest of the Claude Code statusline.
It does not show model names,
 effort levels,
 activity words,
 context-window counters,
 or generic footer replacements.
