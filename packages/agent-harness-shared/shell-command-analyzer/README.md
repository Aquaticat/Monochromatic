# Shell command analyzer

Shared shell-command analysis for agent harness guardrails.

The package parses Bash source with `unbash` and returns command records, redirects,
expansion flags, parse status, and execution context. Callers can distinguish commands
that run while the script is evaluated from commands only stored inside function bodies.
