# Rust Book companion

This workspace contains page-by-page companion material for
[The Rust Programming Language: Experimental Edition](https://rust-book.cs.brown.edu/).
It supplements the book with retrieval practice, TypeScript comparisons, and links into this monorepo's Rust source.
It does not reproduce or replace the book.

## Use

1. Read the source page linked at the start of a lesson.
2. Close or hide the source page before attempting retrieval prompts.
3. Open the matching file in `lessons/` directly in a browser.
4. Reveal feedback only after committing to an answer.
5. Ask the teaching agent about anything unclear.
6. Revisit the linked reference material when the concept appears in monorepo code.

## Structure

- `lessons/`: sequential companions named `NNNN-<source-page>.html`.
- `reference/`: durable, compressed concept references linked by lessons.
- `learning-records/`: demonstrated understanding and established prior knowledge.
- `MISSION.md`: concrete learning outcome and boundaries.
- `RESOURCES.md`: curated primary sources and communities.
- `NOTES.md`: teaching and presentation preferences.

## HTML contract

- Every HTML file is complete and functional when opened through a `file:///` URL.
- This workspace has no build tasks.
- Every HTML file repeats the approved automatic-dark-mode CSS inline.
- Any lesson-specific JavaScript is embedded in that HTML file.
- Graphs and diagrams use HTML and CSS rather than generated images.
- TypeScript comparisons include a link containing the example source for the TypeScript Playground.
- Routine edits do not require `agent-browser` verification.
  Use browser verification when a change introduces JavaScript, a new interaction, or browser-dependent behavior.
