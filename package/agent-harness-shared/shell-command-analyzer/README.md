# Shell command analyzer

Shared shell-command analysis for agent harness guardrails.

The package parses Bash source with `unbash` and returns command records,
redirects,
expansion flags,
parse status,
and execution context.
Argument and redirect records pair parsed values with original shell source spellings.
Literal `for` loop bindings preserve both forms for expansion-provenance checks.
Callers can distinguish commands that run while the script is evaluated
from commands only stored inside function bodies.
