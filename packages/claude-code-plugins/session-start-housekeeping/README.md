# session-start-housekeeping

Claude Code `SessionStart` hook that performs housekeeping tasks when a session starts or resumes.

## What it does

Runs these cleanup steps in parallel on every session startup or resume:

- Creates `/tmp/claude` and `/tmp/claude-1000` directories
- Removes stale git metadata (`HEAD`, `config`, `hooks`, `objects`, `refs`) and `.claude` directories leaked into `packages/*/*/dist/final/`
- Removes the ephemeral `.mcp.json` file from the workspace root

## Hook configuration

```jsonc
// In .claude/settings.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "ccssh",
          },
        ],
      },
    ],
  },
}
```

## Replaces

This single hook replaces four separate command hooks:

```jsonc
{ "type": "command", "command": "mkdir -p /tmp/claude" }
{ "type": "command", "command": "mkdir -p /tmp/claude-1000" }
{ "type": "command", "command": "rm -rf packages/*/*/dist/final/{HEAD,config,hooks,objects,refs,.claude}" }
{ "type": "command", "command": "rm -f .mcp.json" }
```
