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

### Negative prompts

Avoid "Never assume X" when the positive instruction already makes the intent clear.
"Use the current date from the system prompt" is sufficient; "Never assume or guess" is redundant noise.
