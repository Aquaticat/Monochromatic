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
- Structural HTML checks do not verify Rust or tool facts.
  Before completion, classify factual claims as language guarantee, library detail, tool behavior, or simplification;
  verify each class against its primary source and executable counterexample where possible.
- Final factual review must be adversarial and source-specific,
  not prompt reviewer only to recheck previously known wording issues.

## Presentation

- Use plain, standalone HTML that works through `file:///` with no build step.
- Repeat the automatic-dark-mode CSS in every HTML file; do not extract a stylesheet.
- Keep CSS near ten lines and add no presentation rules beyond the approved foreground and background colors.
- Use HTML and CSS for graphs and diagrams.
- JavaScript is allowed and should be embedded when a lesson needs it.
- Keep TypeScript comparisons self-contained and copyable; do not add TypeScript Playground links.
- Do not run `agent-browser` for every edit in this workspace.
  Reserve browser verification for JavaScript, new interactions, or browser-dependent behavior.

## Tooling discoveries

- Do not generate TypeScript Playground links.
  Its compressed `#code` share format required brittle browser interaction:
  Monaco's `setValue` did not update the URL until a real input event,
  and headless clipboard reads were denied after pressing Share.
  The learner is fluent in TypeScript, so copyable source provides more value than maintaining these links.
- Aquascope's binocular view exposes private Rust standard-library layout from its selected toolchain.
  Explain visible labels, but mark the exact wrapper chain as version-dependent and not vocabulary to memorize.
- Aquascope's eye control changes visibility of book-hidden helper source lines;
  it does not alter the program state represented by the snapshots.
- Read an embed's `data-operations` before decoding its marks.
  An embed listing only `interpreter` draws runtime memory and no `R`, `W`, or `O` permission letters,
  so permission material cannot be matched against it.
  The opening diagram on `experiment-intro.html` is such an embed.
- `data-no-interact` does not disable the copy, eye, and binocular controls.
- The copy control copies the full source the widget holds, including every line listed in
  `hidden_lines`, not the displayed subset.
- Binocular labels render without generic arguments:
  the `vec` field shows as `Vec`, never `Vec<u8>`.
- The compact view omits `len` and `cap`; only the binocular view shows them.
- Connector lines rendered in Chromium through `agent-browser` on 2026-07-29.
  Learner's Firefox view omitted them.
  Treat missing connectors as browser rendering discrepancy, not different Rust state;
  pointer dots and surrounding labels remain source of meaning.
- An embed can hold more interpreter steps than it has `state_locations`.
  The opening diagram holds a fifth state at `main`'s closing brace and draws no badge for it.
- Verify decoded claims against the rendered widget rather than the extracted markup alone.
  `agent-browser eval` reading `.aquascope` `innerText` reports exactly what a learner sees.

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
