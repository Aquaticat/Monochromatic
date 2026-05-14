# Terminal-title fork parity testing

This project does not maintain a shared snapshot test that pins behavioral parity
between `packages/pi/terminal-title/` and
`packages/claude-code-plugins/source/src/handlers/terminal-title/`.

## Why this is out of scope

The two harnesses differ too much. pi's hook input shape, Claude Code's hook input
shape, and the surrounding event-routing layers are different enough that any
non-trivial test fixture would have to model both worlds, and the modeling cost
exceeds the value of catching drift.

The forks are real-world drift, not hypothetical: per `AUDIT.dry.md`, the
`formatter-utils.ts` files have a 132-line diff. Forcing them to behave identically
under a synthetic test fixture would mask the legitimate places they need to
diverge.

The right long-term answer is the extraction issue (the formatter and title-builder
move into a shared `module/terminal-title-core` package). Parity tests at that
point apply to the shared core, not to the harnesses.

## What we do instead

- Each fork has its own tests covering its own consumer-shape.
- The extraction issue (separate) reduces the drift to glue-only.
- `AUDIT.dry.md` continues to track the fork as a known duplication item until
  extraction lands.

## Prior issue

- `#174` (closed 2026-05-14): proposed shared snapshot tests. Rejected on the
  grounds that the harness shapes are too different to share fixtures usefully.
