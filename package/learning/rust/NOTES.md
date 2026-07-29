# Notes

## Learner

- Programming background: TypeScript; depth not yet established.
- Rust knowledge has not yet been demonstrated.
- Pace is self-directed.

## Teaching

- Follow the Cognitive Engineering Lab Rust Book page by page.
- Build companion material, not a parallel curriculum or reproduction of the book.
- Tie each concept to first-party Rust in this monorepo when the book has supplied enough context.
- Prefer retrieval practice and immediate feedback over passive summaries.
- Remind the learner to ask follow-up questions.
- Treat every unexplained term, symbol, control, and diagram mark in the source as a companion gap.
- Pair every concept with a concrete worked example; a definition alone is insufficient.
- Introduce technical terms in prerequisite order; first use includes a plain-language meaning and an exact example.
- Never explain one unfamiliar term only with other unexplained terms.
- State what runs automatically, what the programmer invokes, and the exact before-and-after effect of each operation.
- Name the TypeScript relationship for each Rust concept; say explicitly when no direct TypeScript equivalent exists.
- Do not force ownership, moves, borrows, pointers, or deterministic cleanup into misleading TypeScript analogies.
- Avoid vague teaching verbs such as “changes,” “uses,” or “manages” unless the affected value and effect are named.
- Examples may use only established syntax, or must explain every new piece of syntax at the point of use.

## Presentation

- Use plain, standalone HTML that works through `file:///` with no build step.
- Repeat the automatic-dark-mode CSS in every HTML file; do not extract a stylesheet.
- Keep CSS near ten lines and add no presentation rules beyond the approved foreground and background colors.
- Use HTML and CSS for graphs and diagrams.
- JavaScript is allowed and should be embedded when a lesson needs it.
- Every embedded TypeScript comparison must link to a TypeScript Playground URL containing that source.
- Do not run `agent-browser` for every edit in this workspace.
  Reserve browser verification for JavaScript, new interactions, or browser-dependent behavior.

## Tooling discoveries

- TypeScript Playground share links preserve source in a compressed fragment shaped like
  `https://www.typescriptlang.org/play/?#code/<payload>`.
  Generate the payload through the current Playground rather than hand-encoding source.
- In the July 2026 browser check, setting Monaco's model with `setValue` changed editor text
  but did not update the Playground URL until an actual editor input event occurred.
- The headless browser could not read the clipboard after pressing Playground's Share button.
  Read the updated page URL instead of depending on clipboard access.
- Before embedding a Playground link, reopen it, compare the restored editor source with the intended source,
  run it, and inspect its Errors and Logs tabs.
- Aquascope's binocular view exposes private Rust standard-library layout from its selected toolchain.
  Explain visible labels, but mark the exact wrapper chain as version-dependent and not vocabulary to memorize.
- Aquascope's eye control changes visibility of book-hidden helper source lines;
  it does not alter the program state represented by the snapshots.

The canonical inline CSS is:

```css
:root {
  --dark: oklch(0.1 0 0);
  --light: oklch(0.9 0 0);
  @media (prefers-color-scheme: light) { --fg: var(--dark); --bg: var(--light); }
  @media (prefers-color-scheme: dark) { --fg: var(--light); --bg: var(--dark); }
}
html { color: var(--fg); background-color: var(--bg); }
```

The `oklch()` channels are space-separated because that is the current CSS syntax.
Nested `@media` rules remain inside `:root`, as requested.
