//region Contributor name authority

/**
 * English archive labels introducing target-authoritative contributor names.
 */
const CONTRIBUTOR_LABELS = [
  'Contributor for this entry:',
  'Contributors for this entry:',
  'Contributor for this entry：',
  'Contributors for this entry：',
] as const;

/**
 * Splits comma-delimited contributor forms without splitting Markdown links or
 * parenthetical role notes.
 *
 * @param text - contributor suffix after archive label
 *
 * @returns Contributor tokens in source order
 *
 * @example
 * ```ts
 * const forms = splitContributorForms({ text: 'Mika, [Neko](https://example.test)', });
 * ```
 */
function splitContributorForms(
  { text, }: { readonly text: string; },
): readonly string[] {
  /**
   * Completed top-level forms.
   */
  const forms: string[] = [];
  /**
   * Start offset of current form.
   */
  let start = 0;
  /**
   * Markdown label nesting depth.
   */
  let squareDepth = 0;
  /**
   * Link target or role-note nesting depth.
   */
  let roundDepth = 0;
  for (let at = 0; at < text.length; at += 1) {
    /**
     * Character under cursor.
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
       * Whether cursor is delimiter outside labels, links, or role notes.
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
 * Reads visible identity from one contributor token while retaining plain
 * unlinked forms and role notes.
 *
 * @param token - one top-level contributor token
 *
 * @returns Visible target-authoritative form, empty for empty token
 *
 * @example
 * ```ts
 * const form = contributorForm({ token: '[Neko](https://example.test)', });
 * ```
 */
function contributorForm({ token, }: { readonly token: string; },): string {
  /**
   * Token without delimiter-adjacent spacing or list marker.
   */
  const trimmed = token.trim();
  /**
   * Form without optional Markdown unordered-list marker.
   */
  const unmarked = (trimmed.startsWith('- ',)
    || trimmed.startsWith('* ',)
    || trimmed.startsWith('+ ',))
    ? trimmed.slice(2,)
    : trimmed;
  if (!unmarked.startsWith('[',))
    return unmarked;
  /**
   * Boundary between visible label and link destination.
   */
  const labelEnd = unmarked.indexOf('](',);
  if (labelEnd <= 1)
    return unmarked;
  return unmarked.slice(
    1,
    labelEnd,
  );
}

/**
 * Reads target-authoritative contributor names from archive attribution lines.
 *
 * The source can identify same contributor under another script or handle.
 * Existing English archive label is authority because it can carry chosen
 * public handle unrelated to literal transliteration. Ordinary prose is not
 * inspected, so matching words elsewhere never become protected identities.
 *
 * @param text - complete existing English archive page
 *
 * @returns Visible contributor forms, deduplicated, longest first
 *
 * @example
 * ```ts
 * const forms = archiveContributorNameForms({ text: 'Contributors for this entry: Mika, [Neko](https://example.test)', });
 * ```
 */
export function archiveContributorNameForms(
  { text, }: { readonly text: string; },
): readonly string[] {
  /**
   * Archive lines retained because continuation attribution can occupy next
   * nonblank line.
   */
  const lines = text.split('\n',);
  /**
   * Raw contributor suffixes found after canonical archive label.
   */
  const suffixes: string[] = [];
  for (let at = 0; at < lines.length; at += 1) {
    /**
     * Current archive line.
     */
    const line = lines[at] ?? '';
    /**
     * Contributor label this line begins with.
     */
    const label = CONTRIBUTOR_LABELS.find(function begins(candidate,): boolean {
      return line.startsWith(candidate,);
    },);
    if (label === undefined)
      continue;
    /**
     * Names carried beside label, or on immediate continuation lines.
     */
    const sameLine = line
      .slice(label.length,)
      .trim();
    if (sameLine !== '') {
      suffixes.push(sameLine,);
      continue;
    }
    for (let next = at + 1; next < lines.length; next += 1) {
      /**
       * Potential continuation line.
       */
      const continuation = (lines[next] ?? '').trim();
      if (continuation === '')
        break;
      suffixes.push(continuation,);
    }
  }
  /**
   * Visible identities without repeated declarations.
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

//endregion Contributor name authority
