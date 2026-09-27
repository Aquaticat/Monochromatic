import { NAME_FORM_SCOPE_RULE, } from './name-form-policy.ts';

//region Declared identity rule
// HOW A REVIEWER READS THE DECLARED NAMES BLOCK, shared by every sheet that
// judges a translation against it. The critic carried these rules alone, so
// the adjudication panel judging the critic's claims had neither the block
// nor the rules, and a claim against a declared name could be upheld and
// dispute the archive (ledger S4). Worded for any reader: each sheet adds the
// one line saying what it does with a rendering the block makes correct.

/**
 Name of the block every sheet shows the declared identity under.
 */
export const DECLARED_NAMES_HEADING = 'DECLARED NAMES';

/**
 Rules for reading the declared identity, stated once.

 @example
 ```ts
 const system = `${DECLARED_IDENTITY_RULES}\n- Never report such a rendering as a defect.`;
 ```
 */
export const DECLARED_IDENTITY_RULES: string = `Declared identity, when a ${DECLARED_NAMES_HEADING} block precedes the documents:
- That block reproduces what the two documents' own metadata declares about names, alternate handles, and place names. Those declarations are AUTHORITATIVE evidence, not guesses.
- When used to refer to its entity, a name, handle, or place name in the TRANSLATION that matches a declared value is CORRECT, even when it corresponds to the ORIGINAL neither phonetically nor semantically. Transliteration across Chinese, Japanese, and English readings is normal here. Such a rendering is never a wrong term, an unsubstantiated substitution, a fabrication, or an addition. ${NAME_FORM_SCOPE_RULE}
- Likewise, the TRANSLATION carrying only its own declared name where the ORIGINAL carries its own is not an omission of the original name.
- The block is evidence about naming ONLY. It never licenses a defect in the surrounding prose.
- Lines in that block beginning "ORIGINAL note", "ARCHIVE note", "ORIGINAL editor comment" or "ARCHIVE editor comment" reproduce footnotes and editors' comments the two documents carry, and lines beginning "web lookup" reproduce what a web search returned for a work the ORIGINAL names. They establish vocabulary and titles for the terms they name and nothing else: a rendering that follows them is CORRECT for that term, a web lookup is evidence to weigh rather than a declaration, and none of them licenses a defect elsewhere. An "editor comment" line says where the comment sits ("under heading X" or "before the first heading"); a comment that speaks of "this title", "this section" or "here" speaks of that heading and its section and no other, and settles nothing about any other heading.`;

/**
 The declared identity fenced under its heading for a sheet, or nothing
 when the page declares nothing.

 @param fence - fence the sheet encloses its evidence in

 @param identityContext - declared identity lines, absent or empty when none

 @returns Block ending in a newline, or the empty string

 @example
 ```ts
 const block = declaredNamesBlock({ fence: '=====', identityContext: '- name: ORIGINAL declares "猫猫", TRANSLATION declares "Mimi"', },);
 ```
 */
export function declaredNamesBlock(
  {
    fence,
    identityContext,
  }: {
    readonly fence: string;
    readonly identityContext?: string;
  },
): string {
  if ((identityContext === undefined) || (identityContext === ''))
    return '';
  return `${fence} ${DECLARED_NAMES_HEADING} ${fence}\n${identityContext}\n`;
}

//endregion Declared identity rule
