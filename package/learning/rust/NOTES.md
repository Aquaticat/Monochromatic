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

## Presentation

- Use plain, standalone HTML that works through `file:///` with no build step.
- Repeat the automatic-dark-mode CSS in every HTML file; do not extract a stylesheet.
- Keep CSS near ten lines and add no presentation rules beyond the approved foreground and background colors.
- Use HTML and CSS for graphs and diagrams.
- JavaScript is allowed and should be embedded when a lesson needs it.
- Every embedded TypeScript comparison must link to a TypeScript Playground URL containing that source.

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
