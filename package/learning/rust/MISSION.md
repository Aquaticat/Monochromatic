# Mission: Rust

## Why

Read the Cognitive Engineering Lab edition of The Rust Programming Language page by page,
using focused companion material to understand every use of Rust in this monorepo.
The companion should connect unfamiliar Rust concepts to an existing TypeScript mental model
without becoming a replacement course.

## Success looks like

- Read first-party Rust source in this monorepo and explain what it does and why it is valid.
- Explain ownership, borrowing, lifetimes, traits, concurrency, unsafe boundaries, and Cargo usage where they occur here.
- Modify, test, and debug the monorepo's Rust packages with a clear model of compiler diagnostics and runtime behavior.
- Compare Rust with TypeScript without incorrectly transferring JavaScript runtime assumptions.

## Constraints

- Learning is self-paced and follows the experimental Rust Book's page order and emphasis.
- Lessons are short, plain HTML companions rather than a newly sequenced curriculum.
- Every HTML file works when opened directly through a `file:///` URL; this workspace has no build tasks.
- Each HTML file repeats the minimal automatic-dark-mode CSS inline; there is no shared stylesheet.
- Graphs and diagrams use HTML and CSS. JavaScript is allowed when it produces a tighter feedback loop.
- TypeScript comparisons are self-contained and copyable; they do not require Playground links.
- Label every unfamiliar term, symbol, control, and diagram mark when it first appears.
- Demonstrate every introduced concept with a concrete example rather than only defining it.
- Explain each technical term before using it to explain another term.
- State exact execution and state changes, including whether startup invokes code automatically.
- Mark concepts with no direct TypeScript equivalent instead of inventing a misleading analogy.

## Out of scope

- Replacing or reproducing the experimental Rust Book.
- Teaching topics ahead of the book unless current monorepo context requires a brief preview.
- Assuming systems-programming knowledge not established by the learner.
