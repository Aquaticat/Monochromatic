# prompt-time

Claude Code `UserPromptSubmit` hook that injects the current local system time into Claude's conversation context.

## What it does

On every user prompt,
 prepends the following tag to Claude's context:

```text
<time>HH:MM</time>
```

The hour and minute are read from the system's local 24-hour clock at the moment the prompt is submitted.
 The user's prompt text is not inspected or modified.

## Hook configuration

```jsonc
// In .claude/settings.json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccpt",
          },
        ],
      },
    ],
  },
}
```

## Why local time

`<time>HH:MM</time>` reflects what the user sees on the clock when typing,
 which is the relevant frame for any time-sensitive request ("schedule for an hour from now",
 "what time did I send the last message").
 UTC would force every reader to re-derive the local interpretation.

The format intentionally omits seconds,
 date,
 and timezone:
 Claude already has the date in the system prompt,
 and seconds add noise without value at human conversation cadence.
