// Fixture: a chain with a comment between segments. Expected: stylistic(chain-per-line)
// reports, but the autofix is suppressed so the comment is never relocated.

declare const obj: any;

const r = obj.b // keep this note beside .b
  .c.d;

export { r, };
