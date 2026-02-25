# AGENTS.md philosophy

## Purpose

AGENTS.md is for non-obvious, actionable guidance that an agent cannot infer from context or general knowledge.
It supplements, not replaces, common sense.

## What does not belong

### Repository identity and high-level structure

Do not describe what the project is, what its core features are, or sketch its architecture unless those facts carry constraints an agent would not otherwise know.
A capable agent reading the codebase will infer these faster and more accurately than a written description.

Removed:

- "Repository Information" -- obvious from package names and directory structure
- "Core Features" -- obvious from the packages directory
- "Architecture" -- was empty; real architecture constraints belong in specific technical sections

### Generic section titles

Avoid titles like "Important Reminders", "Notes", or "Miscellaneous".
Content with such titles belongs in a topically relevant section.
When no section fits, add one with a specific name.

### Runtime environment checks

Do not put detection logic or compatibility warnings in AGENTS.md when a hook can enforce the same constraint automatically and silently.
AGENTS.md text is passive -- an agent reads it once and may not apply it consistently.
A hook fires on every session start and injects a warning directly into context only when the condition is actually violated.

**Removed: "Detecting the Current Shell"**

The original section told agents how to detect whether the shell is bash-compatible (checking `$SHELL`, recognizing `pwsh`, etc.) and how to adjust syntax accordingly.
This was removed because:

1. AI agents already assume bash-compatible syntax by default and do not need to be told to.
2. The detection instructions were only useful if something was already wrong -- a condition better caught by automation.
3. A `SessionStart` hook covers the failure case with no AGENTS.md noise for the common case.

**Hook setup**

The replacement is `~/.factory/hooks/check-shell.ts`, registered in `~/.factory/settings.json` as a global personal hook.
It runs on every session start, reads `SHELL`, and injects a warning into the session context when the shell is not in `{bash, zsh, sh, dash, ksh}`.
On a compatible shell it exits silently.

`~/.factory/hooks/check-shell.ts`:

```ts
/**
 * SessionStart hook: warns Droid if the current shell is not bash-compatible.
 * AI tooling assumes bash syntax; non-compatible shells cause silent command failures.
 */
const shell = Bun.env.SHELL ?? "";
const shellName = shell.split("/").at(-1) ?? "";
const bashCompatibleShells = new Set(["bash", "zsh", "sh", "dash", "ksh"]);

if (shellName && !bashCompatibleShells.has(shellName)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: `Shell warning: current shell is ${shellName} (SHELL=${shell}), which is not bash-compatible. Use bash-compatible syntax for all shell commands, or prefix commands with \`bash -c\`.`,
      },
    }),
  );
}
```

`~/.factory/settings.json` (relevant excerpt):

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bun run ~/.factory/hooks/check-shell.ts"
      }
    ]
  }
]
```

### Tool usage examples and rationale

Do not include syntax examples for standard tools (e.g. `rg`, `gh`, `curl`) or explain why a well-known tool is useful.
Any competent agent or developer already knows how to use `ripgrep` or when to reach for official documentation over source code.
Explaining these things wastes tokens on every context load and signals distrust of the reader.

Removed:

- `rg` examples (`-t ts`, `--type ts`, `-A 5 -B 5`) -- standard ripgrep flags, universally known
- "Reach for this first when working with a third-party library: the official docs are usually faster..." -- states the obvious

What belongs instead: the name of the tool, what it covers in this project's context, and any non-obvious constraint (e.g. "raw source is still useful when docs are incomplete").

### Negative prompts

Avoid "Never assume X" when the positive instruction already makes the intent clear.
"Use the current date from the system prompt" is sufficient; "Never assume or guess" is redundant noise.
