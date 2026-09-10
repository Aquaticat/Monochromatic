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

The initial translation slate already contained the archive's distinguishing wording:
GLM-flash and Mercury both reproduced it.
Qwen3.8 supplied the name-normalized version that won 3.5 weight against two.
Its self-vote explicitly justified using declared `Mio` for `澪`.
The remaining candidate copied the Chinese source after an author repair;
judges recognized that it was untranslated.
A quoted-form exception must not license copying the whole source-language quotation.

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
The accepted terminology issue explicitly demanded preserving and glossing the Chinese group name instead of
using the archived English name;
its adjudication had four supporting and two opposing ballots.
The issue therefore enters before editing,
not only in the final writer.
`~/temp/agent/Mio12-name-origin-20260910.out` records the issue and initial translation slate.

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
## Completed name-form measurement

`proc_b0ce` completed `translation-repair-name-form-probe-20260910` on frozen `b5da9866b` in 139 seconds.
The script is `~/temp/agent/probe-name-form-20260910.mjs`;
log `~/temp/agent/name-form-probe-20260910.log`;
report `~/temp/agent/name-form-probe-20260910/report.json`.
The offline plan was exercised successfully.

The experiment keeps the recorded anonymous slate and all non-system messages fixed.
It asks the six original responding judges directly in both arms,
not through different prompt-rotated subsets,
and then asks Qwen3.8 and Mercury to write under both arms.
There are at most 16 model requests,
six concurrent requests,
a 360000 ms exchange bound and a 1200000 ms global bound.
Normal production completion caps remain unchanged.
Mio12's completed-prompt cache is copied into the disposable probe directory for reuse where identities match.
The original cache and corpus are untouched.

The treatment clarifies reference-name authority versus quoted spelling or character forms,
and distinguishes conversational tone from literal filler transliteration.
No production prompt has changed yet.
Read the actual judgments and writing,
including the untranslated-copy negative control,
before deciding whether to integrate the wording.
This experiment does not yet measure the group-name repair path or the separate source-context change.

Both treatment writers preserve `澪` and `Mio`.
Qwen's baseline conflated them;
its treatment retains the character and uses `uhh` instead of `aba`.
Mercury retains the archive wording in both arms.
All writing outputs compile.
Qwen's treatment changes quote typography,
so this is not a claim that every output detail is publication-ready.

Judging improved only partially:
two of six baseline judgments select the distinguishing archive wording,
versus three of six under the treatment.
DeepSeek-flash changes to that candidate and explicitly recognizes the erased contrast.
Gemma-e2b,
Mercury and Qwen still prefer the normalized version.
Qwen invokes the new filler warning to object to the archive's apology while still treating its character as
unnecessary mixed-script text.
No judge selects the untranslated-copy negative control.
These are per-seat results on a fixed slate,
not the production window's tally.

The eight baseline requests reused completed Mio12 payloads.
Eight new calls are logged:
two Bedrock calls costing 0.00059064 USD,
two OpenRouter calls reporting zero cost,
and four Hyper calls without per-call prices.
The daily helper ran after the probe.
Evidence is `~/temp/agent/name-form-probe-spend-20260910.out` and
`~/temp/agent/name-form-costs-after-20260910.out`.

The treatment is not ready to be copied verbatim into production.
Its appended guidance leaves the existing unqualified declared-name criterion in place,
and its filler warning can distract from the core contrast.
Next test the form exception inside the actual faithfulness and name-authority criteria,
without bundling it with a filler preference.
Preserve the existing official-English-work-title and contributor precedence rules when sharing name authority.
The group-name editor path and source-context treatment are still unmeasured.

## Completed inline-criterion measurement

`proc_75c1` completed `translation-repair-inline-name-scope-probe-20260910` on frozen `b5da9866b` in 40 seconds.
The offline plan passed.
The script is `~/temp/agent/probe-inline-name-scope-20260910.mjs`,
log `~/temp/agent/inline-name-scope-probe-20260910.log`,
and report `~/temp/agent/inline-name-scope-probe-20260910/report.json`.

Only the existing faithfulness exemption and name-authority criterion change.
The treatment distinguishes references to entities from mentions of language forms inside those rules,
instead of leaving their unqualified versions next to an appended exception.
It contains no new filler warning,
new candidate,
source annotation,
producer identity or changed candidate order.
Reversing the criterion replacements restores every original message byte.
The experiment makes six direct judge requests,
with a 360000 ms exchange deadline and a 720000 ms global deadline.
It reuses the recorded baseline rather than purchasing it again.

Read the choices and reasons before selecting an integration.
The original slate's English candidates also differ in framing and filler treatment,
so a split result does not alone prove inability to recognize a pure spelling contrast.
No requirement that every model agree is being introduced.

Four of six judgments now select the distinguishing archive wording,
versus two on the recorded baseline and three with the appended rule.
Mercury and DeepSeek-flash explicitly identify the erased contrast;
Gemma-e2b changes to the distinguishing candidate as well.
Qwen still prefers the normalized name.
DeepSeek-pro also picks it,
but its explanation incorrectly claims that this candidate contains `澪`.
The candidate data and numbering were verified unchanged,
so that explanation is not treated as evidence that it preserves the character.
No judge selects the untranslated copy.

The inline exception is the selected judging remedy,
without a requirement for unanimous agreement.
It changes the active criteria rather than leaving an unqualified name rule next to a competing appendix.
The writer-side evidence from the first experiment supports carrying the same reference-versus-mention distinction
into the existing name rule.
Do not carry its filler warning or broaden archived-name authority over the official-English-title rule.

Logged spend:
two Bedrock calls totaling 0.00056812 USD,
one OpenRouter call reporting zero cost,
two unpriced Hyper calls and one unpriced Synthetic call.
The daily helper ran after the measurement.
`~/temp/agent/inline-name-scope-spend-20260910.out` records the provider totals.

Guard `9e727def9` now specifies the shared scope in initial writing,
repair editing,
consolidation,
criticism and lane selection,
plus the actual translation criteria.
The group-name policy and temporal-context measurements remain separate pending work.
## Integration and group-name measurement

`514db9b1f` integrates the measured quoted-form scope in initial translation,
repair editing,
consolidation,
criticism,
shared contest policy and the actual translation criteria.
`9e727def9` failed six integration cases before that change.
`fd293e6d3` updates older literal-wording assertions,
and `b55a42a0a` explicitly names the declared-identity exemption so an `it` or `they` cannot be read as exempting
mentioned word forms from coverage.
Dedicated metadata criteria remain unchanged.
No filler warning or output-rejection rule was added.

The group-name measurement completed in 103 seconds.
It isolates the actual Mio terminology claim rather than replaying the original multi-claim packet.
Baseline judgments support that claim five to one;
the proper-name scope produces three supporting and three opposing judgments.
Replaying those actual votes through `tallyVotes` changes the claim from `accepted` to `needs-human`,
so it no longer authorizes an editor correction under the existing strict-majority rule.
This is not a claim that all judges now reject it.
The explicit-definition control receives five supporting baseline votes and six under treatment.
Ordinary definitions are not excused by the name exception.

Evidence:
`~/temp/agent/archive-name-gloss-probe-20260910/report.json`,
`~/temp/agent/archive-name-gloss-replay-20260910.out`
and `~/temp/agent/archive-name-gloss-spend-20260910.out`.
The measured source scope is identical under the prior frozen and current adjudication builders.
The probe logged 0.00219198 USD on Bedrock,
zero reported OpenRouter cost,
eight unpriced Hyper calls and four unpriced Synthetic calls.
The daily helper ran afterward.

`272db0e92` fails without the scoped first-use rule;
`8a59469f2` integrates it in the existing vocabulary policy.
It retains the owner's [inline-gloss rule](../decision/translation-repair-inline-gloss.md)
and adds no curated glossary entry.
The corpus writing principles and the owner's stronger translation rule were both read before editing the policy.
`9578ad0bc` supplies the composed export's required type annotation.
`85f7bac01` makes fidelity-fixture assertions identify judges instead of relying on prompt-rotated arrival order.

Build,
types,
oxlint and the full suite pass through `85f7bac01`.
The suite ends `unit exit 0` in `~/temp/agent/naming-final-unit-20260910.out`.

The current-build integration probe completed as `proc_87ab`
(`translation-repair-naming-integration-20260910`)
on frozen `85f7bac01` in 49 seconds.
It runs the real `runTranslateStage` over the opening with Qwen3.8 and Mercury writing and the six original
responding judges seated.
It allows at most 20 stage requests,
a 360000 ms exchange bound and a 720000 ms global bound.
Its report is `~/temp/agent/naming-integration-probe-20260910/report.json`
and log `~/temp/agent/naming-integration-probe-20260910.log`.
It used six stage requests:
two writer calls and four judge calls.
Qwen produced a fresh wording retaining the elliptical `澪?` and the separate name `Mio`,
without the archive's added question-about-meaning framing.
Mercury reproduced the archive.
All four responding judges selected Qwen's fresh rendering,
with the ordinary self-vote weight retained.
There was no structural repair,
follow-up generation or outage fallback.
The text compiles and the canonical source hash is unchanged.
This verifies the combined current-build instructions through the producing and selecting stage,
not only their presence in a prompt.

The integration logged two Bedrock calls costing 0.00056918 USD,
two OpenRouter calls reporting zero cost,
and two unpriced Synthetic calls.
The post-probe daily helper ran.
`~/temp/agent/naming-integration-spend-20260910.out` records the totals.

The name-policy work is verified locally and at the bounded live stage.
The remaining material follow-ups are archive apparatus/copy-edit treatment and temporal source context.
No probe or full-entry pass is active.
