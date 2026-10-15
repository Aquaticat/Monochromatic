//region Verify that a parser's claimed statement/comment spans leave only whitespace outside them.
export class SourceCoverageError extends Error {
  constructor() {
    super('Parser spans do not cover the complete parent program apart from whitespace');
    this.name = 'SourceCoverageError';
  }
}
/** Check ordered spans and return the first offset after their complete coverage. */
function coveredEnd({source,intervals}){
  let cursor=0;
  for(const {start,end} of intervals){
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)
      ||start<0||end<=start||end>source.length)throw new SourceCoverageError();
    if(start<cursor){
      // Comments inside an outer statement are covered by its complete source span.
      if(end>cursor)throw new SourceCoverageError();
      continue;
    }
    if(source.slice(cursor,start).trim()!=='')throw new SourceCoverageError();
    cursor=end;
  }
  return cursor;
}
/** Validate complete parser coverage while scanning disjoint source gaps once. */
export function assertSourceCoverage({
  source,
  statements,
  comments
}) {
  const intervals = [
    ...statements,
    ...comments
  ].toSorted(function compareComposedSpans(
    left,
    right
  ) { return ( (left.start - right.start) || (right.end - left.end)); });
  const cursor=coveredEnd({source,intervals});
  if(source.slice(cursor).trim()!=='')throw new SourceCoverageError();
}
//endregion
