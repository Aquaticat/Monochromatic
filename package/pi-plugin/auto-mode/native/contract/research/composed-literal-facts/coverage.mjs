//region Verify that a parser's claimed statement/comment spans leave only whitespace outside them.
export class SourceCoverageError extends Error {
  constructor() {
    super('Parser spans do not cover the complete parent program apart from whitespace');
    this.name = 'SourceCoverageError';
  }
}
export function assertSourceCoverage({ source, statements, comments }) {
  const intervals = [...statements, ...comments].toSorted((left, right) => left.start - right.start || right.end - left.end);
  let cursor = 0;
  for (const interval of intervals) {
    const { start, end } = interval;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > source.length) throw new SourceCoverageError();
    if (start < cursor) {
      // Comments inside an outer statement are already covered by its complete source span.
      if (end > cursor) throw new SourceCoverageError();
      continue;
    }
    if (!/^\s*$/u.test(source.slice(cursor, start))) throw new SourceCoverageError();
    cursor = end;
  }
  if (!/^\s*$/u.test(source.slice(cursor))) throw new SourceCoverageError();
}
//endregion
