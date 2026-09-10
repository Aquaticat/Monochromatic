# Mio12 wording follow-up

## Scope

The owner delegated the best preventive changes after rejecting guard-first treatment of verse flattening.
Mio12 now has published-page evidence for the verse remedy.
Its separate stored-review quorum failure is fixed through `b5da9866b`.
This follow-up distinguishes fidelity and policy failures from optional wording preferences.
No corpus edit,
new correction loop,
roster change or broader publication rejection is proposed.

Evidence files:

- `~/temp/agent/Mio12-wording-trace-20260910.out`.
- `~/temp/agent/Mio12-wording-summary-20260910.out`.
- `~/temp/agent/Mio12-archive-review-trace-20260910.out`.
- `~/temp/agent/Mio12-20260910/artifacts/Mio.json`.
- `~/temp/agent/Mio12-20260910/fixed/people/Mio/page.en.md`.

## Names as references versus names as the subject of a quotation

Source slice zero distinguishes the character `澪` from the chosen name `Mio`.
The original archive retains that distinction.
The translation lane replaces both with `Mio`,
so the question and denial can read as denying her own name.
The repair lane retains the character but adds a pronunciation gloss.
That gloss is unnecessary to preserve the contrast.

The contest chose translation:
three ballots for translation,
one for repair and two for neither.
The repair ballot explicitly identified the name-denial problem;
other ballots objected to the added reading gloss.
Consolidation endorsed the standing translation.
The final paragraph refiner did not touch the blockquote,
and the later naturalness findings were recorded without generating new work.

The exact identity context declares only Mio's name,
alias,
location and she pronoun.
It supplies no alternative interpretation of the character in the question.

The writer and editor rules do not distinguish referring to a person from discussing a word's spelling or form.
`translate-wire.ts` enforces declared and archived name spelling.
`edit-prompt.ts` additionally requires translating source-language quotations fully,
while preserving genuinely foreign phrases with a gloss.
Those general rules need an explicit scope boundary:
name authority does not normalize the different forms that a passage is comparing.
Preserving a quoted character as the subject of the sentence does not leave ordinary prose untranslated.
No speculative pronunciation or etymology is needed.

The trailing `aba` has a related issue:
it transcribes a source-language filler instead of communicating its conversational tone.
Preserve the tone without requiring a literal transliteration or inventing an apology.
The intended change needs a bounded writer and selection probe before a full pass.

## Archive names in the repair lane

Source slice four names the QQ group in mixed script.
The archived English calls it `Harunome Hanbai`.
The repair replaces that with Chinese,
a romanized name and an English gloss.
The translation alternative drops the archive's list,
and the repair wins.

The initial translator has an explicit archived-name authority rule;
the editor's rule list does not share it and instead emphasizes foreign-phrase preservation plus glossing.
Consolidating the authority rule across the writing and judging roles is preferable to a list of special group names.
This must preserve declared-name precedence and contributor identity rules.
It must also retain the names-as-mentioned distinction described in this document.

## Temporal and participant ambiguity

Slice four retains the archived bullet about coming out to a best friend "in primary school".
The surrounding source is about the last year of her life.
The following source section describes an April 2022 reconnection and the friend coming out to Mio.
The page's later paragraph preserves that event direction.

The bullet therefore warrants source-context checking,
not an automatic token replacement:
both the modifier's attachment and who disclosed to whom matter.
A general remedy must preserve event participants and temporal scope,
not merely replace `in` with `from` or assert an unsupported reciprocal disclosure.
The actual `neighbouringSource` call for slice four has been checked.
It supplies slice three's childhood SRS paragraph and slice five's heading,
not slice six's April 2022 reconnection and disclosure paragraph.
The deciding event context is outside that physical-slice window.
See `~/temp/agent/Mio12-temporal-context-20260910.out`.
This supports testing a meaningful source-context boundary before adding stronger temporal instructions;
it does not establish how the models will respond to that change.

## Translation-side apparatus and faithful but defective English

`Translation:` is recognized by `isVerifiableEditorialArchiveBlock`:
the actual invocation returns true.
Nevertheless,
archive revision selection deleted the first chat's label.
A recorded selector reason says it is translation-side apparatus rather than factual prose,
"therefore should be removed".
That contradicts the existing criterion to retain verifiable editorial apparatus.

`archive-block-review-stage.ts` calls the selection task an "unsupported archive-only block"
before the selection has established that it is unsupported.
The task should describe an unclaimed block neutrally.
No new deterministic retention whitelist is needed;
the label is already recognized.

The first chat is retained verbatim,
including `musculine` and other usage issues.
The source image `people/Mio/photos/photo7.webp` was inspected directly:
it is Chinese chat with a Chinese embedded post,
not an English-original passage whose spelling must be sealed.

The review classifications overlap:
`source-supported` means the block states source content,
while `revise` includes defective prose.
A faithful translation with a typo fits both descriptions.
If reviewers choose retention,
`recordArchiveBlockNaturalness` records defects but cannot change the text.
That audit-only behavior is deliberate under the no-loop design.

The proposed preventive treatment is within the existing first review:
classify clear unintended English defects as a minimal revision even when facts are supported;
reserve retention for wording needing no material correction;
retain useful apparatus rather than treating its non-factual nature as grounds for deletion.
Do not add a rejection-triggered copy-edit loop or loosen source support.
Probe the classification and actual selected text,
not just prompt wording.

## Optional wording preferences

The university phrase `a local 985 (a top-tier university)` is awkward,
but its meaning is explained.
The source acronym `SRS` gained an expansion in initial translation and consolidation.
These deserve terminology and readability checking,
but they do not independently justify another whole-entry pass solely for stylistic preference.
No unsupported terminology assertion or new glossary entry has been implemented.

## Next work

- Build a bounded prototype for shared name authority,
  quoted-form preservation and conversational filler handling.
- Prototype a source-context boundary that reaches the dated reconnection paragraph,
  then measure selection with unchanged candidates and instructions.
- Probe neutral archive-review framing and non-overlapping revision criteria in the existing graph.
- Keep passing verse and quorum behavior intact.
- Resume the entry queue only after the material findings have an evidenced remedy and the required page reading.

A focused advisor call about prioritization timed out without feedback.
It supplies no endorsement or objection.
No paid translation probe or full-entry pass is active.
