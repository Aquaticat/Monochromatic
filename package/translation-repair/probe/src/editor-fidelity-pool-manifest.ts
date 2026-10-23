import { DRAWN_EDITOR_SPECS_1, } from './editor-fidelity-pool-drawn-1.ts';
import { DRAWN_EDITOR_SPECS_2, } from './editor-fidelity-pool-drawn-2.ts';
import { DRAWN_EDITOR_SPECS_3, } from './editor-fidelity-pool-drawn-3.ts';
import { DRAWN_EDITOR_SPECS_4, } from './editor-fidelity-pool-drawn-4.ts';
import { REVIEWED_FIDELITY_REFERENCES, } from './fidelity-reference-manifest.ts';
import type { FidelityReferenceSpec, } from './fidelity-reference-model.ts';

//region Editor fidelity pool
// THE FROZEN POOL every arm and every later run of the editor fidelity probe reads, so every card sees the same trials.
//
// FOUR TRIALS CANNOT SEPARATE EFFORT LEVELS: every card that fixes all four reads the same. The pool is the three
// source-reviewed references, first and unchanged, and the heading sections drawn beside them from the same corpus pin
// by the rule named THE RULE in this header, which together stand for at least forty trials of the two defects that
// have a deterministic fix.
//
// NOT SOURCE-REVIEWED. A drawn section was chosen by a rule and replayed, never read for meaning by a person. That is
// enough here because the score compares the patched text with the text before the defect was planted, so what the
// reference says is not what is measured; `reviewedOn` on a drawn specification dates its freeze and says nothing
// of review.
//
// THE RULE (the draw script is kept with the round's report, and it gives this manifest again byte for byte). Entries
// in id order, leaving out the entries the reviewed references hold. An entry takes part when its Chinese and English
// pages split into the same number of heading sections with matching leading kinds, which is the production aligner's
// own fast path. A section is eligible when its folded English is 400 to 2200 characters and its Chinese is at most 2200
// characters. Per entry, the insertion trial is the first eligible section, in document order, whose borrowed-sentence
// twin builds (the donor is the furthest other section that gives a usable sentence) and that passes the scoreability
// check; the alteration trial is the first such section other than that one whose altered-number twin builds, else that
// one. The draw stops after the entry that takes the pool, reviewed trials counted, to at least forty trials.
//
// THE SCOREABILITY CHECK, per trial: the trial builds with one envelope; scoring the clean text reads exact and
// untouched; scoring the damaged text reads not fixed; and a scripted editor that applies the known fix through the real
// stage path (its sheet, its parse and its apply gate) is read as fixed with nothing else touched. Two insertions at the
// end of a section failed it, because removing the sentence leaves the separator before it, and were passed over.
//
// ONLY IDS, OFFSETS AND HASHES ARE COMMITTED. The corpus is unlicensed. Each run reads the pinned clone and checks every
// range and every damaged twin against these hashes, as it does for the reviewed references.

/**
 The references and heading sections the editor fidelity probe draws its trials from, the reviewed references first.

 @example
 ```ts
 const specs: readonly FidelityReferenceSpec[] = EDITOR_FIDELITY_POOL;
 ```
 */
export const EDITOR_FIDELITY_POOL: readonly FidelityReferenceSpec[] = [
  ...REVIEWED_FIDELITY_REFERENCES,
  ...DRAWN_EDITOR_SPECS_1,
  ...DRAWN_EDITOR_SPECS_2,
  ...DRAWN_EDITOR_SPECS_3,
  ...DRAWN_EDITOR_SPECS_4,
];

//endregion Editor fidelity pool
