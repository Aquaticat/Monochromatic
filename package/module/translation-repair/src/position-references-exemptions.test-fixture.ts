/**
 The references by position the D33 guard leaves, each with its reason:
 model-facing sheet text, positions in a page's own text, comparisons and
 orders in time the phrase shapes cannot tell apart, quoted log lines, and the
 guard's own fixtures and examples. Data rather than logic, so the guard and a
 probe listing what it would name read one list.

 @module
 */

import type { PositionExemption, } from './position-references.test-fixture.ts';

//region Exemptions

/**
 References in the package the guard leaves, each with its reason.
 */
export const PACKAGE_EXEMPTIONS: readonly PositionExemption[] = [
  {
    path: 'src/adjudicate-prompt.ts',
    holds: 'numbered claims below against the TRANSLATION',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/adjudicate-prompt.ts',
    holds: 'claims below may describe one defect',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/adjudicate-prompt.unit.test.ts',
    holds: 'GROUP 1 (claims below may describe one defect',
    reason: 'asserts the sheet text that line renders',
  },
  {
    path: 'src/adjudicate-prompt.unit.test.ts',
    holds: 'GROUP 2 (claims below',
    reason: 'asserts the sheet text that line renders',
  },
  {
    path: 'src/candidate-select-wire.ts',
    holds: 'Every block below opens and closes',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/edit-prompt.ts',
    holds: 'THE HOUSE RULES BELOW OUTRANK',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/lane-contest-wire.ts',
    holds: 'ARCHIVE RENDERING shown above',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/page-title-lexicon-wire.ts',
    holds: 'under the house rules below',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/corpus-run/probe-verify-sheet.ts',
    holds: 'Every item below is an edit the pipeline applied',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/refine-prompt.ts',
    holds: 'for the reasons quoted below',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/refine-prompt.ts',
    holds: 'the quoted findings below',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/rendering-audit-prompt.ts',
    holds: 'evidence given below',
    reason: 'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of',
  },
  {
    path: 'src/archive-original-note.ts',
    holds: 'note above Hanasaka',
    reason: 'a position in a page\'s own text, which the code handles as data',
  },
  {
    path: 'src/corpus-run/insertion-carried-shift.ts',
    holds: 'the paragraph after them on its own',
    reason: 'a position in a page\'s own text, which the code handles as data',
  },
  {
    path: 'src/corpus-run/publish-fixed.unit.test.ts',
    holds: 'over the paragraph after it',
    reason: 'a position in a page\'s own text, which the code handles as data',
  },
  {
    path: 'src/inspect-paragraph.unit.test.ts',
    holds: 'ends the sentence after it',
    reason: 'a position in a page\'s own text, which the code handles as data',
  },
  {
    path: 'src/corpus-run/artifact-two-lane-read-pairing.ts',
    holds: 'Section before this one, absent at the first position',
    reason: 'the section the loop read before this one, an element of the data',
  },
  {
    path: 'src/corpus-run/transcription-suspect.unit.test.ts',
    holds: 'Transcription of the note above',
    reason: 'fixture page text, a position in the page',
  },
  {
    path: 'src/consolidate-standing-verdict.unit.test.ts',
    holds: 'as under the rule before it',
    reason: 'the rule in force before it, an order in time',
  },
  {
    path: 'src/corpus-run/cap-override.unit.test.ts',
    holds: 'cut every entry before it',
    reason: 'an entry cut before it bought anything, an order in time',
  },
  {
    path: 'src/refine-phase-slice.ts',
    holds: 'The former sequential phase',
    reason: '"former" as an adjective for a design since replaced',
  },
  {
    path: 'src/translate-retry.ts',
    holds: 'nobody named below the rest',
    reason: 'a ranking, a comparison',
  },
  {
    path: 'src/corpus-run/run-config.ts',
    holds: 'read below Flash',
    reason: 'a score below another model\'s, a comparison',
  },
  {
    path: 'doc/roster-changes.md',
    holds: 'read below Flash',
    reason: 'a score below another model\'s, a comparison',
  },
  {
    path: 'doc/mistake-prevention.md',
    holds: 'breaking the rule after it took its current wording',
    reason: 'after the rule took its wording, an order in time',
  },
  {
    path: 'src/corpus-run/meter-sample-read.unit.test.ts',
    holds: 'The METERS line above is the record',
    reason: 'a fixture quoting the sampler\'s own log line',
  },
  {
    path: 'src/corpus-run/spend-read.unit.test.ts',
    holds: 'the SPEND line above is the record for this call',
    reason: 'a fixture quoting the spend log\'s own line',
  },
  {
    path: 'doc/audit-ledger.md',
    holds: 'the heading after it; the living-docs case',
    reason: 'the heading that closes a kept range, named in the guard that reads it',
  },
  {
    path: 'doc/audit-ledger.md',
    holds: 'account paragraphs that pointed at the paragraph before them',
    reason: 'M60\'s heading, naming the mistake it records',
  },
  {
    path: 'src/position-references-exemptions.test-fixture.ts',
    holds: '',
    reason: 'this list, which quotes each phrase it leaves',
  },
  {
    path: 'src/position-references.unit.test.ts',
    holds: '',
    reason: 'the guard\'s own fixtures, each a positional phrase by design',
  },
  {
    path: 'src/position-references-text.test-fixture.ts',
    holds: 'the case above',
    reason: 'the guard\'s own examples of the phrase it reads',
  },
  {
    path: 'src/position-references.test-fixture.ts',
    holds: 'phrase: \'case above\'',
    reason: 'the guard\'s own example of a finding',
  },
  {
    path: 'src/position-references.test-fixture.ts',
    holds: 'text: \'// see above\'',
    reason: 'the guard\'s own example of a file it reads',
  },
];

/**
 References in the living repository-level docs the guard leaves.
 */
export const REPOSITORY_EXEMPTIONS: readonly PositionExemption[] = [
  {
    path: 'doc/handover/translation-repair-handover-2026-09-06.md',
    holds: 'note above Hanasaka',
    reason: 'a position in a page\'s own text, which the code handles as data',
  },
  {
    path: 'doc/planning/translation-repair-openrouter-2026-09-03.md',
    holds: 'the former lover',
    reason: 'a noun phrase: a lover in the page\'s story',
  },
  {
    path: 'doc/planning/translation-repair-openrouter-2026-09-03.md',
    holds: 'Chinese line above them',
    reason: 'a position in a page\'s own text, which the code handles as data',
  },
];

//endregion Exemptions
