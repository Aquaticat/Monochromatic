# claude-code-plugins-terminal-title

Claude Code hook that sets the terminal tab title to reflect current activity.

## What it shows

### Tool events

Tool titles reflect tense -- present during execution (PreToolUse), past after completion (PostToolUse).

- **Bash**: Running git status
- **Read**: Reading index.ts / Read index.ts
- **Edit**: Editing foo.ts / Edited foo.ts
- **Write**: Writing foo.ts / Wrote foo.ts
- **Grep**: Searching "pattern" / Searched "pattern"
- **Glob**: Finding "*.ts" / Found "*.ts"
- **Agent**: Agent: find API endpoints / Agent done: find API endpoints
- **WebSearch**: Searching "react hooks" / Searched "react hooks"
- **WebFetch**: Fetching example.com / Fetched example.com
- **AskUserQuestion**: Asking: Which library? / Asked: Which library?
- **NotebookEdit**: Editing notebook analysis.ipynb / Edited notebook analysis.ipynb
- **LSP**: LSP: goToDefinition / LSP done: goToDefinition
- **Skill**: Skill: commit / Skill done: commit
- **ToolSearch**: Discovering: slack / Discovered: slack
- **EnterPlanMode**: Entering plan mode / In plan mode
- **ExitPlanMode**: Exiting plan mode / Exited plan mode
- **EnterWorktree**: Creating worktree: bold-oak / Created worktree: bold-oak
- **TaskCreate**: Creating task: Fix login bug / Created task: Fix login bug
- **TaskGet**: Task #1
- **TaskList**: Listing tasks / Listed tasks
- **TaskOutput**: Reading task output #1 / Read task output #1
- **TaskStop**: Stopping task #1 / Stopped task #1
- **TaskUpdate**: Updating task #1 / Updated task #1
- **CronCreate**: Scheduling: run tests / Scheduled: run tests
- **CronDelete**: Deleting cron #abc / Deleted cron #abc
- **CronList**: Listing cron jobs / Listed cron jobs
- **PermissionRequest**: Permission: Bash
- **PostToolUseFailure**: Failed: Bash

### Session and lifecycle events

- **SessionStart**: Session startup / Session resume
- **SessionEnd**: Session ended
- **InstructionsLoaded**: Loaded CLAUDE.md
- **UserPromptSubmit**: (shows the prompt text)
- **Stop**: Stopped

### Agent and task events

- **SubagentStart**: Subagent: Explore
- **SubagentStop**: Subagent done: Explore
- **TeammateIdle**: Idle: reviewer
- **TaskCompleted**: Task done: Fix login bug

### Other events

- **Notification**: (shows notification title or message)
- **ConfigChange**: Config: project_settings
- **WorktreeCreate**: Worktree: bold-oak-a3f2
- **WorktreeRemove**: Worktree removed
- **PreCompact**: Compacting (auto)

## Terminal compatibility

Works with any terminal that supports OSC 0 title sequences:
Ptyxis, Konsole, Wezterm, Ghostty, iTerm2, kitty, and others.

## How it works

The hook receives JSON on stdin from Claude Code,
extracts a descriptive summary based on the tool and its input,
and writes `\x1b]0;title\x07` directly to `/dev/tty`.

Hooks run outside the sandbox, so `/dev/tty` is accessible.

## Setup

Install the package to your workspace root, which makes the `cctt` bin available.
Then add the hook to `.claude/settings.local.json`:

```jsonc
// .claude/settings.local.json
{
  "hooks": {
    "SessionStart": [{ "type": "command", "command": "cctt" }],
    "InstructionsLoaded": [{ "type": "command", "command": "cctt" }],
    "UserPromptSubmit": [{ "type": "command", "command": "cctt" }],
    "PreToolUse": [{ "type": "command", "command": "cctt" }],
    "PermissionRequest": [{ "type": "command", "command": "cctt" }],
    "PostToolUse": [{ "type": "command", "command": "cctt" }],
    "PostToolUseFailure": [{ "type": "command", "command": "cctt" }],
    "Notification": [{ "type": "command", "command": "cctt" }],
    "SubagentStart": [{ "type": "command", "command": "cctt" }],
    "SubagentStop": [{ "type": "command", "command": "cctt" }],
    "Stop": [{ "type": "command", "command": "cctt" }],
    "TeammateIdle": [{ "type": "command", "command": "cctt" }],
    "TaskCompleted": [{ "type": "command", "command": "cctt" }],
    "ConfigChange": [{ "type": "command", "command": "cctt" }],
    "WorktreeCreate": [{ "type": "command", "command": "cctt" }],
    "WorktreeRemove": [{ "type": "command", "command": "cctt" }],
    "PreCompact": [{ "type": "command", "command": "cctt" }],
    "SessionEnd": [{ "type": "command", "command": "cctt" }],
  },
}
```
