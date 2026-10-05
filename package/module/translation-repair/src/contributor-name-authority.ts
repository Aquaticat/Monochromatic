import { findDroppedDeclaredNames, } from './declared-name-survival.ts';

//region Contributor name authority

/**
 English archive labels introducing target-authoritative contributor names.
 */
export const CONTRIBUTOR_LABELS = [
  'Contributor for this entry:',
  'Contributors for this entry:',
  'Contributor for this entry：',
  'Contributors for this entry：',
] as const;

/**
 Splits comma-delimited contributor forms without splitting Markdown links or
 parenthetical role notes.

 @param text - contributor suffix after archive label

 @returns Contributor tokens in source order

 @example
 ```ts
 const forms = splitContributorForms({ text: 'Mika, [Neko](https://example.test)', });
 ```
 */
function splitContributorForms(
  { text, }: { readonly text: string; },
): readonly string[] {
  /**
   Completed top-level forms.
   */
  const forms: string[] = [];
  /**
   Start offset of current form.
   */
  let start = 0;
  /**
   Markdown label nesting depth.
   */
  let squareDepth = 0;
  /**
   Link target or role-note nesting depth.
   */
  let roundDepth = 0;
  for (let at = 0; at < text.length; at += 1) {
    /**
     Character under cursor.
     */
    const character = text.charAt(at,);
    if (character === '[')
      squareDepth += 1;
    else if ((character === ']') && (squareDepth > 0))
      squareDepth -= 1;
    else if (character === '(')
      roundDepth += 1;
    else if ((character === ')') && (roundDepth > 0))
      roundDepth -= 1;
    else {
      /**
       Whether cursor is delimiter outside labels, links, or role notes.
       */
      const atTopLevelDelimiter = (character === ',')
        && (squareDepth === 0)
        && (roundDepth === 0);
      if (atTopLevelDelimiter) {
        forms.push(text.slice(
          start,
          at,
        ),);
        start = at + 1;
      }
    }
  }
  forms.push(text.slice(start,),);
  return forms;
}

/**
 Reads visible identity from one contributor token while retaining plain
 unlinked forms and role notes.

 @param token - one top-level contributor token

 @returns Visible target-authoritative form without the spaces around it,
 empty for an empty token or a link label empty or only spaces, which shows a
 reader nothing

 @example
 ```ts
 const form = contributorForm({ token: '[Neko](https://example.test)', });
 ```
 */
function contributorForm({ token, }: { readonly token: string; },): string {
  /**
   Token without delimiter-adjacent spacing or list marker.
   */
  const trimmed = token.trim();
  /**
   Form without optional Markdown unordered-list marker, nor the further
   spaces a marker may stand before its item with.
   */
  const unmarked = (trimmed.startsWith('- ',)
    || trimmed.startsWith('* ',)
    || trimmed.startsWith('+ ',))
    ? trimmed
      .slice(2,)
      .trimStart()
    : trimmed;
  if (!unmarked.startsWith('[',))
    return unmarked;
  /**
   Boundary between visible label and link destination.
   */
  const labelEnd = unmarked.indexOf('](',);
  if (labelEnd === (-1))
    return unmarked;
  // The label as a reader sees it: spaces inside the brackets show nothing.
  return unmarked
    .slice(
      1,
      labelEnd,
    )
    .trim();
}

/**
 One archive line the contributor reader takes as a declaration: a line that
 opens with a contributor label, or a line continuing one whose label stands
 alone.

 @example
 ```ts
 const declaration: ContributorDeclarationLine = { line: 0, names: 'Mika', };
 ```
 */
export type ContributorDeclarationLine = {
  /**
   Index of the line in the text split at line feeds.
   */
  readonly line: number;
  /**
   Names the line carries, trimmed: what follows the label on a label line,
   the whole line on a continuation; empty for a label line whose names
   follow on the lines after it.
   */
  readonly names: string;
};

/**
 Lines the contributor reader takes as declarations, in order.

 ONE READING FOR EVERY QUESTION ASKED OF A DECLARATION (T8's eighteenth
 batch, ledger B81): which names a block declares, and whether a block is
 declarations and nothing else, read the same lines. A label line declares
 the names after its label; a label standing alone declares the nonblank
 lines that follow it, up to the first blank one. Only a line that opens
 with a label counts, so the same words inside a sentence declare nothing.

 @param text - archive text, a page or one block

 @returns Each declaring line with the names it carries

 @example
 ```ts
 contributorDeclarationLines({ text: 'Contributor for this entry:\nMika', },); // [{ line: 0, names: '' }, { line: 1, names: 'Mika' }]
 ```
 */
export function contributorDeclarationLines(
  { text, }: { readonly text: string; },
): readonly ContributorDeclarationLine[] {
  /**
   Archive lines, kept whole because a label standing alone hands its names
   to the lines after it.
   */
  const lines = text.split('\n',);
  /**
   Declaring lines found so far.
   */
  const declarations: ContributorDeclarationLine[] = [];
  for (const [at, line,] of lines.entries()) {
    /**
     Contributor label this line begins with.
     */
    const label = CONTRIBUTOR_LABELS.find(function begins(candidate,): boolean {
      return line.startsWith(candidate,);
    },);
    if (label === undefined)
      continue;
    /**
     Names carried beside the label.
     */
    const sameLine = line
      .slice(label.length,)
      .trim();
    declarations.push({
      line: at,
      names: sameLine,
    },);
    if (sameLine !== '')
      continue;
    /**
     Index of the first line that may continue the label.
     */
    const start = at + 1;
    /**
     Lines after the label, which continue it up to the first blank one.
     */
    const following = lines.slice(start,);
    for (const [offset, next,] of following.entries()) {
      /**
       Names a continuation line carries.
       */
      const continuation = next.trim();
      if (continuation === '')
        break;
      declarations.push({
        line: start + offset,
        names: continuation,
      },);
    }
  }
  return declarations;
}

/**
 Reads target-authoritative contributor names from archive attribution lines.

 The source can identify same contributor under another script or handle.
 Existing English archive label is authority because it can carry chosen
 public handle unrelated to literal transliteration. Ordinary prose is not
 inspected, so matching words elsewhere never become protected identities.

 @param text - complete existing English archive page

 @returns Visible contributor forms, deduplicated, longest first

 @example
 ```ts
 const forms = archiveContributorNameForms({ text: 'Contributors for this entry: Mika, [Neko](https://example.test)', });
 ```
 */
export function archiveContributorNameForms(
  { text, }: { readonly text: string; },
): readonly string[] {
  /**
   Raw contributor suffixes the declaring lines carry, a label standing
   alone carrying none of its own.
   */
  const suffixes = contributorDeclarationLines({ text, },)
    .map(function namesOf(declaration,): string {
      return declaration.names;
    },)
    .filter(function carriesNames(names,): boolean {
      return names !== '';
    },);
  /**
   Visible identities without repeated declarations.
   */
  const forms = new Set(suffixes
    .flatMap(function split(suffix,): readonly string[] {
      return splitContributorForms({ text: suffix, });
    },)
    .map(function visible(token,): string {
      return contributorForm({ token, });
    },)
    .filter(function nonempty(form,): boolean {
      return form !== '';
    },),);
  return [ ...forms, ].toSorted(function longestFirst(
    left,
    right,
  ): number {
    return right.length - left.length;
  },);
}

/**
 Reports whether two contributor spellings project to same complete identity.

 @param left - one visible contributor form

 @param right - other visible contributor form

 @returns Whether forms differ only by supported name separators or markup

 @example
 ```ts
 const same = contributorFormsMatch({ left: 'Snow_Cat', right: 'Snow Cat', });
 ```
 */
export function contributorFormsMatch(
  {
    left,
    right,
  }: {
    readonly left: string;
    readonly right: string;
  },
): boolean {
  /**
   Left projected identity losses when compared into right.
   */
  const leftDropped = findDroppedDeclaredNames({
    forms: [left,],
    baseText: left,
    candidateText: right,
  },);
  /**
   Right projected identity losses when compared into left.
   */
  const rightDropped = findDroppedDeclaredNames({
    forms: [right,],
    baseText: right,
    candidateText: left,
  },);
  return (leftDropped.length === 0) && (rightDropped.length === 0);
}

/**
 Finds target-authoritative contributor forms missing or respelled in candidate.

 @param archiveText - existing English attribution authority

 @param candidateText - proposed wording

 @returns Missing target forms in archive order

 @example
 ```ts
 const dropped = droppedContributorNameForms({ archiveText, candidateText, });
 ```
 */
export function droppedContributorNameForms(
  {
    archiveText,
    candidateText,
  }: {
    readonly archiveText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   Target-authoritative archive forms.
   */
  const forms = archiveContributorNameForms({ text: archiveText, },);
  /**
   Forms candidate attribution currently carries.
   */
  const candidateForms = archiveContributorNameForms({ text: candidateText, },);
  return forms.filter(function absent(form,): boolean {
    return !candidateForms.some(function matches(candidate,): boolean {
      return contributorFormsMatch({
        left: form,
        right: candidate,
      },);
    },);
  },);
}

//endregion Contributor name authority
