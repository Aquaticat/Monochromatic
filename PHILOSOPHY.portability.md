# Portability and Core Principles

## Portability and interoperability

Portable, interoperable, detachable.
No platform-specific solutions.

### Repository permissions

A cloned repository should not dictate what software on someone else's machine can do.
Checked-in tool permission files (e.g. `.claude/settings.json`) stay empty.
Users maintain their own permission lists in their home directory (`~/.claude/settings.json`).

### Markdown features

Plain markdown readability with optional enhanced tooling.
