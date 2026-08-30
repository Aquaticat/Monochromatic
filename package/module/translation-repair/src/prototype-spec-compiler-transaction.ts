// PROTOTYPE ONLY: Candidate B exact transaction admission and merge.

import type { SourceUnit, } from './prototype-brief-editor-plan.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';
import type {
  CompilerChange,
  CompilerDocument,
} from './prototype-spec-compiler-wire.ts';

export type LocatedCompilerChange = CompilerChange & {
  readonly at: number;
  readonly end: number;
};

export function exactCompilerIds(
  {
    expected,
    actual,
    label,
  }: {
    readonly expected: readonly string[];
    readonly actual: readonly string[];
    readonly label: string;
  },
): void {
  if ((new Set(actual,).size !== actual.length)
    || (expected.length !== actual.length)
    || expected.some(function missing(id,) { return !actual.includes(id,); }))
    throw new Error(`${label} ids differ from manifest`);
}

function occurrenceCount(
  { text, needle, }: { readonly text: string; readonly needle: string; },
): number {
  let count = 0;
  let at = 0;
  while ((needle !== '') && (at < text.length)) {
    const found = text.indexOf(needle, at,);
    if (found === -1)
      return count;
    count += 1;
    at = found + needle.length;
  }
  return count;
}

function locateChanges(
  {
    base,
    sourceText,
    changes,
    allowedKinds,
  }: {
    readonly base: string;
    readonly sourceText: string;
    readonly changes: readonly CompilerChange[];
    readonly allowedKinds: ReadonlySet<string>;
  },
): readonly LocatedCompilerChange[] {
  const located = changes.map(function locate(change,): LocatedCompilerChange {
    if ((change.before === change.after) || (change.before.length === base.length))
      throw new Error('compiler transaction has no-op or whole-document change');
    if (!allowedKinds.has(change.kind,))
      throw new Error('compiler transaction exceeds role authority');
    if (occurrenceCount({ text: sourceText, needle: change.sourceQuote, },) !== 1)
      throw new Error('compiler transaction source anchor is not unique');
    if (occurrenceCount({ text: base, needle: change.before, },) !== 1)
      throw new Error('compiler transaction base anchor is not unique');
    const at = base.indexOf(change.before,);
    return { ...change, at, end: at + change.before.length, };
  },).toSorted(function byStart(left, right,) {
    return left.at - right.at;
  },);
  for (let index = 1; index < located.length; index += 1) {
    const prior = located[index - 1];
    const current = located[index];
    if ((prior !== undefined) && (current !== undefined) && (current.at < prior.end))
      throw new Error('compiler transaction changes overlap');
  }
  return located;
}

function applyLocated(
  {
    text,
    located,
  }: {
    readonly text: string;
    readonly located: readonly LocatedCompilerChange[];
  },
): string {
  return located.toSorted(function laterFirst(left, right,) {
    return right.at - left.at;
  },).reduce(function apply(current, change,) {
    return `${current.slice(0, change.at,)}${change.after}${current.slice(change.end,)}`;
  }, text,);
}

export function validateCompilerDocument(
  {
    response,
    expectedMode,
    expectedBaseDigest,
    sourceText,
    archiveText,
    sourceUnits,
    sourcePictures,
    base,
    allowedKinds,
  }: {
    readonly response: CompilerDocument;
    readonly expectedMode: CompilerDocument['mode'];
    readonly expectedBaseDigest: string | null;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourceUnits: readonly SourceUnit[];
    readonly sourcePictures: readonly { readonly assetName: string; }[];
    readonly base?: string;
    readonly allowedKinds: ReadonlySet<string>;
  },
): readonly LocatedCompilerChange[] {
  if ((response.mode !== expectedMode) || (response.baseDigest !== expectedBaseDigest))
    throw new Error('compiler response mode or base digest differs');
  exactCompilerIds({
    expected: sourceUnits.map(function id(unit,) { return unit.id; },),
    actual: response.realizations.map(function id(realization,) { return realization.sourceUnitId; },),
    label: 'compiler realization',
  },);
  if (response.realizations.some(function absent(realization,) {
    return occurrenceCount({ text: response.document, needle: realization.targetQuote, }) < realization.occurrence;
  },))
    throw new Error('compiler realization locator is absent');
  if ((expectedMode !== 'revision') && (response.changes.length !== 0))
    throw new Error('compiler first-candidate response carries transaction');
  const located = base === undefined
    ? []
    : locateChanges({ base, sourceText, changes: response.changes, allowedKinds, });
  if ((base !== undefined) && (applyLocated({ text: base, located, }) !== response.document))
    throw new Error('compiler document differs from transaction replay');
  validateSerialCandidate({
    sourceText,
    archiveText,
    sourcePictures,
    candidate: response.document,
  },);
  return located;
}

function rangesOverlap(
  {
    left,
    right,
  }: {
    readonly left: LocatedCompilerChange;
    readonly right: LocatedCompilerChange;
  },
): boolean {
  return (left.at < right.end) && (right.at < left.end);
}

export function mergeCompilerRole(
  {
    current,
    accepted,
    response,
    located,
  }: {
    readonly current: string;
    readonly accepted: readonly LocatedCompilerChange[];
    readonly response: CompilerDocument;
    readonly located: readonly LocatedCompilerChange[];
  },
): { readonly document: string; readonly accepted: readonly LocatedCompilerChange[]; } {
  if (located.some(function conflicts(change,) {
    return accepted.some(function overlaps(prior,) { return rangesOverlap({ left: change, right: prior, }); },);
  },))
    throw new Error('compiler role conflicts with higher-priority transaction');
  const currentLocated = response.changes.map(function locateCurrent(change,) {
    if (occurrenceCount({ text: current, needle: change.before, },) !== 1)
      throw new Error('compiler role anchor drifted after prior transaction');
    const at = current.indexOf(change.before,);
    return { ...change, at, end: at + change.before.length, };
  },).toSorted(function byStart(left, right,) { return left.at - right.at; },);
  const document = applyLocated({ text: current, located: currentLocated, });
  return { document, accepted: [...accepted, ...located,], };
}

export function adoptCompilerRole(
  {
    current,
    accepted,
    response,
    located,
    validate,
  }: {
    readonly current: string;
    readonly accepted: readonly LocatedCompilerChange[];
    readonly response: CompilerDocument;
    readonly located: readonly LocatedCompilerChange[];
    readonly validate: (document: string) => void;
  },
): {
  readonly applied: boolean;
  readonly document: string;
  readonly accepted: readonly LocatedCompilerChange[];
  readonly failureType?: string;
} {
  try {
    const merged = mergeCompilerRole({ current, accepted, response, located, },);
    validate(merged.document,);
    return { applied: true, ...merged, };
  }
  catch (error) {
    return {
      applied: false,
      document: current,
      accepted,
      failureType: Error.isError(error,) ? error.constructor.name : 'unknown',
    };
  }
}
