// Fixture: a chain whose only comment sits inside trailing call arguments, after
// the sole break offset. Expected: stylistic(chain-per-line) reports and the autofix
// applies, because renderCanonical slices the call-args verbatim, so the comment in
// the continuation slice is never relocated (contrast invalid/chain-comment.ts, whose
// comment precedes the first break and so suppresses the fix).

declare const obj: { a: { method(value: number,): number; }; };

const r = obj.a.method(
  // keep this note inside the call
  1,
);

export { r, };
