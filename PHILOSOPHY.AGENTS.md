# AGENTS.md philosophy

## Purpose

AGENTS.md is for non-obvious, actionable guidance that neither an AI agent nor a human developer can infer from context or general knowledge alone.
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

### Code examples for rules that are self-explanatory

Code examples belong in AGENTS.md only when the rule itself is ambiguous without one.
When a rule is clear from its text (e.g. "prefer `const` over `let`"), the example adds tokens without adding understanding.

Examples that illustrate **what to flag during review** belong in the code-review skill, not in AGENTS.md.
This way the examples load only when a review is happening, not on every session.

### Explanatory rationale for standard practices

Drop rationale like "for better tree-shaking" or "to improve build performance" when the practice is widely understood.
Keep rationale only when the reasoning is project-specific or counterintuitive.

### Detailed sub-rules for generic workflows

Compress multi-bullet expansions of a single rule into one line when the sub-bullets are obvious consequences.

Example: "Never modify files in cloned third-party repositories -- use configuration, env vars, or wrapper scripts" replaces five bullets explaining why modification is bad and what the alternatives are.

## What was compressed (2025-02-25)

AGENTS.md was reduced from 5839 words to ~1500 words.
The following categories of content were handled:

### Moved to code-review skill

All bad/good code examples were relocated to `.factory/skills/code-review/SKILL.md` where they serve as patterns for the reviewing agent to flag:

- Functional vs imperative loop examples
- Object iteration (`for...in` vs `Object.entries`) examples
- Named condition extraction examples
- Single-letter variable examples
- Manual promise creation (`new Promise` vs `wait()`) examples
- TSDoc WHY-vs-WHAT comment examples
- TSDoc block comment terminator escaping examples
- Symbol union narrowing anti-pattern examples
- Generics `const`/`readonly` good/bad examples
- Custom error class examples
- Assertion function examples
- Type guard examples
- `notNullishOrThrow` vs `!` operator examples
- Silent error handling examples
- CSS shorthand, color token, and state styling examples
- Region marker examples
- Commit message format and multi-scope examples

### Dropped as inferable

- "Check web sources, session history, or codebase as appropriate" -- implied by "search for evidence"
- Detailed CLI tool execution patterns (`uv run script.py` not `uv run python script.py`) -- generic agent knowledge
- Third-party repo rationale bullets ("breaks git pull", "creates merge conflicts") -- obvious consequences of the rule
- "Convert callback-based APIs to promises" -- implied by "async/await only"
- "Implement interfaces explicitly when a class should conform to a contract" -- standard TypeScript knowledge
- "Use abstract classes sparingly, prefer interfaces and composition" -- standard OOP knowledge
- "Document version requirements in both the pinning file and README" -- generic practice
- "Regularly review pinned versions to check if constraints still apply" -- generic practice
- TSDoc rationale about "obvious from context" and "dead code" caveats -- the rule to document all declarations is sufficient
- Individual type descriptions for commit types (`style: Changes that do not affect...`) -- Conventional Commits is a well-known spec
- `dprint` enforcement notes -- the tool config speaks for itself
- "For arrow functions, make sure the JavaScript engine can infer a name" -- inferable from "always name functions"

### Kept in compressed form

Rules that are non-obvious or project-specific were retained as terse single-line bullets:

- Progressive simplification pattern (imperative -> while -> for -> recursive -> HOF)
- File-splitting justification comment clause
- "Never remove logging" philosophy
- "Avoid meta-references" documentation standard
- "Avoid deprecated features" with `substr()` example
- Assertion functions (`asserts value is T`)
- Type guard pattern
- `as` over angle bracket syntax; conditional type nesting warning
- Unused variable underscore-prefix convention
- `process.exitCode` only for non-standard codes
- "Combine console.log/error messages into thrown errors"
- `outdent` import path (`@cspotcode/outdent`)
- Generic `Function` type ban; unused Generator params

### Skill file structure change

Skills were moved from `.factory/skills/<name>.md` to `.factory/skills/<name>/SKILL.md` to match the expected Droid skill format.
