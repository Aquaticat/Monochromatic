//region Publish defects
// A SETTLED PAGE SHIPS WITH ITS DEFECTS REPORTED (the owner, 2026-09-27,
// `doc/design-commitments.md`). The publish-time content checks used to
// refuse the whole entry, discarding hours of settled work so the archive's
// page shipped instead: seven real entries lost about 10.3 hours that way to a
// single dropped link destination each (ledger E1). Each check still runs and
// still names what it found; its own refusal becomes a reported defect, and
// the page ships.
//
// ONLY THE CHECK'S OWN REFUSAL IS A DEFECT. Anything else a check throws is a
// fault in the code and still stops the entry, so a bug is never shipped as a
// content report. A page that does not parse is not collected here at all:
// it would break the site build, and still refuses.

/**
 A content check at publish whose failure ships as a reported defect.

 @example
 ```ts
 const check: PublishCheck = 'destinations';
 ```
 */
export type PublishCheck =
  | 'archive-original'
  | 'contributor-names'
  | 'destinations'
  | 'front-matter'
  | 'headings';

/**
 One failed content check the page shipped with.

 @example
 ```ts
 const defect: PublishDefect = { check: 'headings', message: 'entry Cat collapses 2 source headings into 1', };
 ```
 */
export type PublishDefect = Readonly<{
  /**
   Check that failed.
   */
  check: PublishCheck;

  /**
   What its refusal said, which names ids, counts and slice indices only.
   */
  message: string;
}>;

/**
 One check to run, and the refusal class that marks its failure.

 @example
 ```ts
 const step: PublishCheckStep = { check: 'headings', refusal: CollapsedHeadingError, run: function headings() { assertHeadingsStayDistinct({ entryId, sourceText, pageText, },); }, };
 ```
 */
export type PublishCheckStep = Readonly<{
  /**
   Which check this is.
   */
  check: PublishCheck;

  /**
   Class the check throws when the page fails it.
   */
  refusal: abstract new (...parameters: never[]) => Error;

  /**
   Runs the check, throwing its refusal on a failure.
   */
  run: () => void;
}>;

/**
 Runs every content check and collects the failures as defects.

 @param steps - checks to run, in order

 @returns Defects the page ships with, empty for a clean page

 @throws Whatever a check raises other than its own refusal

 @example
 ```ts
 const defects = publishDefects({ steps, },);
 ```
 */
export function publishDefects(
  { steps, }: { readonly steps: readonly PublishCheckStep[]; },
): readonly PublishDefect[] {
  return steps.flatMap(function defectOf({
    check,
    refusal,
    run,
  },): readonly PublishDefect[] {
    try {
      run();
      return [];
    }
    catch (error) {
      if (!(error instanceof refusal))
        throw error;
      return [{
        check,
        message: error.message,
      },];
    }
  },);
}

/**
 The line a pass prints beside its tally for a page that shipped with
 defects, so a grep over a pass totals them.

 @param entryId - entry the page belongs to

 @param defects - failed checks it shipped with

 @returns `DEFECTS <id> checks=<a>,<b>`, or empty for a clean page

 @example
 ```ts
 const line = defectsLine({ entryId: 'BookshopCat', defects, },);
 ```
 */
export function defectsLine(
  {
    entryId,
    defects,
  }: {
    readonly entryId: string;
    readonly defects: readonly PublishDefect[];
  },
): string {
  if (defects.length === 0)
    return '';
  /**
   Failed checks, in the order they ran.
   */
  const checks = defects.map(function checkOf({ check, },): string {
    return check;
  },);
  return `DEFECTS ${entryId} checks=${checks.join(',',)}`;
}

//endregion Publish defects
