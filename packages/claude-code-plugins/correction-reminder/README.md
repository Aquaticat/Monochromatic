# correction-reminder

Claude Code `UserPromptSubmit` hook that detects correction phrases in user input and reminds Claude to call `advisor` before its next substantive response.

## What it does

When the user submits a prompt containing a correction phrase, this hook injects the following block into Claude's conversation context:

```text
<correction-detected>
The user is correcting a substantive claim from your previous response.
Per AGENTS.md Pre-response checklist item 11: a user correction is an
approach-change moment, not a small patch. The blind spot that produced
the original claim is still active for the revision.

Before your next substantive response, call the advisor tool.
It receives your full transcript, so it can see the blind spot you cannot.
</correction-detected>
```

When the prompt is neutral, the hook returns an empty `additionalContext` so the rest of the pipeline runs unchanged.

## Triggering phrases

The hook fires on any of the following patterns in user input (case-insensitive, word-boundary matched):

- "demonstrably false" / "demonstrably wrong"
- "you missed"
- "didn't you"
- "you're wrong" / "you are wrong"
- "shouldn't have" / "should not have"
- "why would you"
- "that's wrong" / "this is wrong"
- "you got that/this/it wrong"
- "please be more careful"

## Why this hook exists

Session evidence (`1cbe8d82`): four consecutive user corrections each produced a fresh error in the revision. The blind spot that produced the original claim was active for each revision because each was framed as a small patch rather than as a change-of-approach moment that warrants surfacing the transcript to a stronger reviewer.

This hook fires before the response is written, which is the highest-leverage point at which to redirect.

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
            "command": "cccr",
          },
        ],
      },
    ],
  },
}
```
