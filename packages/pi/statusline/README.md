# pi-statusline

Pi extension that adds one footer status: Anthropic rate-limit usage warnings.

It ports only the warning behavior from `packages/claude-code-plugins/statusline`:
when remaining capacity is low, or recent burn rate projects past the reset point,
Pi shows a compact status segment.

## What it displays

Comfortable usage renders nothing.
No news is good news.

Low remaining capacity renders a remaining-capacity warning:

```text
tokens 40% left (3h)
```

Projected overflow appends the extrapolated end-of-window usage:

```text
tokens 60% left →120% (4h)
```

The `→120%` marker means the last two sampled provider responses imply the current burn rate
will exceed available capacity before the reset time if it continues.

Multiple constrained limiters are joined with a centered dot:

```text
input 20% left (45s) · output 8% left (2m)
```

## How it works

Pi exposes provider response headers through the `after_provider_response` event.
The extension reads Anthropic rate-limit headers, including:

- `anthropic-ratelimit-tokens-limit`
- `anthropic-ratelimit-tokens-remaining`
- `anthropic-ratelimit-tokens-reset`
- matching input-token, output-token, unified-token, and Priority Tier headers

For each complete header group, the extension calculates remaining percentage.
It renders when either condition is true:

- remaining capacity is 50% or lower
- sampled burn rate projects above 100% before the reset time

Projection needs two samples for the same header group.
The first response records a baseline, and later responses compare usage growth over elapsed wall-clock time.
This differs from the Claude Code statusline payload, which already provides `used_percentage` for fixed five-hour
and seven-day windows.
Pi has Anthropic headers instead, so the extension uses the reset timestamp and observed deltas.

## Colors

The warning uses Pi theme colors:

- success: 26% to 50% remaining
- warning: 11% to 25% remaining
- error: 10% or less remaining, or any projected overflow

## Installation

Add the package to Pi settings:

```json
{
  "packages": ["./packages/pi/statusline"]
}
```

For local testing without installation:

```bash
pi --extension ./packages/pi/statusline/src/index.ts
```

## Scope

This package intentionally does not port the rest of the Claude Code statusline.
It does not show model names, effort levels, activity words, context-window counters, or generic footer replacements.
