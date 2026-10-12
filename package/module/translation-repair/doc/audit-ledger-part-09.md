# Audit ledger, part 09

Part 09 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Test suite, continued

### T8: code no unit test runs, continued

The third cluster of that census,
`rendering`,
against `census-MgQUMe` at `f5ae72c9a`:
10 stretches over `rendering-audit-corroborate.ts`,
`rendering-audit-anchor.ts` and `rendering-audit-screen.ts`
(`18f0b3a85`,
`0bea2bc58`),
with 2 more the per-source whole-file reading found in `nearMisses`.
Three became `nonNullishOrThrow`
(two empty-group invariant throws,
whose groups are built from their claims or grown from a seed,
and a `tokens[0]` fallback over a split that always returns one element).
Nine are cased:
the one-sided readers of `corroborate`
(the unused interval,
the unused-side refusal to intersect,
the both-unused agreement)
and `byAgreement`'s ordering;
the near-miss refusals for one voice's own claims
and for one defect named twice;
the rule mapping's throw,
reached through `quotesRequired` exported for it (rule XPT)
with a category cast past its type;
and the quote canonicalization's length tripwire,
reached through an optional `fold` a case supplies
(no text breaks the maps themselves:
a probe over 12 shapes including a CRLF pair,
an astral character and CJK punctuation found none).
B178 deleted the cast case for one that asks the rule about every category of the vocabulary.
The reach census (`~/temp/agent/mimo-trial/reach-rendering2.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and every edited source "loaded it and left 0 cold stretches".
No B entry found.

The fourth cluster of that census,
`corpus-run/final`,
against `census-7Aczvk` at `0beef6dc0`:
10 stretches over `final-naturalness-completeness.ts` and `final-selection-completeness.ts`
(`e0bf15a10`,
`3da0a9a3b`).
The polish branch's consolidation narrowing moved before the contests loop,
where every call runs it
and the not-run cases carry its other arm,
its `: undefined` fallback having been dead
(polish wording exists only inside a settled consolidation).
Eleven cases cover the rest:
the completeness guards' refusals
(the contested body slice,
the settled polish without a review,
the front-matter slice under any record but its own skip),
their exemptions
(the pending contest,
the all-front-matter contested set,
the unsafe-baseline standing,
the empty archive,
the consolidated slice polish rewrote),
and the lane-won and endorsed readings inside the polish branch.
The reach census (`~/temp/agent/mimo-trial/reach-final2.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The fifth cluster of that census,
`corpus-run/meter`,
against `census-DbGZ25` at `cedebd9eb`:
10 stretches over `meter-dry-span.ts` and `meter-sample-read.ts`
(`729931a40`).
Three `??` fallbacks came out for `nonNullishOrThrow`
(the two wet-neighbour bounds and the first token of a tail),
each backed by a walk that pushes one entry per element.
Seven are cased:
the absent-provider skip,
the `longestDrySpan` reducer's arms,
the no-state field beside a repeated name,
the separator-less level field beside its level-shaped control,
and the three unstamped prefixes
(no bracket at all,
a level bracket with none after it,
and one that never closes).
The reach census (`~/temp/agent/mimo-trial/reach-meter.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and both edited sources "loaded it and left 0 cold stretches".
No B entry found.

The sixth cluster of that census,
`fidelity`,
against `census-Ai2qpF` at `4c8eb9c03`:
9 stretches over `fidelity-alteration.ts` and `fidelity-damage.ts`
(`e9d07984e`).
Two came out:
the `occursOnce` absence arm,
whose only caller draws the needle from the same text with `digitRuns`,
and the insertion's unchanged refusal,
`applySeededErrors` throwing `needle absent from current text`
before any no-op could reach it.
Seven are cased,
the two unchanged and empty deletion refusals among them through an optional
`needle` and `anchor` a case supplies
(the seed's pick by default),
so a splice point the text lacks is a test's to give.
The reach census (`~/temp/agent/mimo-trial/reach-fidelity.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and both edited sources "loaded it and left 0 cold stretches".
No B entry found.

The seventh cluster of that census,
`decision`,
against `census-bR9IAH` at `3a184963e`:
9 stretches over `decision-contract.ts` and `decision-context-refusal.ts`
(`045c0e2f5`,
`750ec0708`).
The parse catch now names its detail and carries the failure as cause
(the shape `hyper-credits.ts` already uses),
its non-Error fallback arm having been unreachable
(a JSON parse throws only `SyntaxError`).
Nine are cased in `decision-contract.unit.test.ts` (new,
the module leaving the own-unit-tests allowlist)
and `stage-decision-call.unit.test.ts`:
the answer guard's refusals and its three documented answers,
the reply reader's refusals (non-JSON,
non-object,
no answers,
a mistyped answer,
no model),
its shaped returns (no usage,
usage only for paired token counts,
`costUsd` only for a numeric cost),
and the over-context gate's status refusal
(a 503 whose body names the marker stays a lost voice).
The reach census (`~/temp/agent/mimo-trial/reach-decision3.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The eighth cluster of that census,
`openrouter`,
against `census-XzBVZf` at `5d6f6335d`:
9 stretches over `openrouter-abandoned-spend.ts`,
`openrouter-chunk-scan.ts`,
`openrouter-cached-tokens.ts`,
`openrouter-cost.ts` and `openrouter-client.ts`
(`adcfeb5d4`,
`b3cfd5637`,
`780e4d267`).
One is cased through a seam:
the ratio ternary's `unmeasured` arm is reachable by shape
(the card side types `rawCharsPerToken` as `number | 'unmeasured'`
and `corpus-run/roster-card-render.ts` generates that spelling)
with no roster card carrying it,
so the ternary reads through the exported `rawCharsPerCompletionTokenOf`
and one case pins the fallback to the median of the measured card ratios
rather than to a literal.
Three are the wire readers' refusals,
cased in their own files:
the not-a-record chunk and the not-a-safe-integer count,
each reading `unreported` since neither states a count,
and the not-finite cost the same way
(`adcfeb5d4`).
Five are `openrouter-client.ts`'s:
the armed-deadline arm,
the deadline-joined signal arm and the caller `maxAnswerChars` spread,
cased together with the answer read back under both knobs,
and the cost and cached-token conditional spreads,
folded with the endpoint spread behind the exported `reportedSpendFieldsOf`
(the shape the fidelity batch gave `needle` and `anchor`),
the cached field's only observable being the spend line `chatText` discards:
one case pins the field combinations,
one meter pair proves the wiring
(a bare stream leaves the meter flat,
a costed one moves it 0.5).
B179 found the reason untrue:
`reportSpend` logs that spend line,
and a case now reads the endpoint and the cached tokens off it.
The reach census found three more to settle (`b3cfd5637`):
the record guard's skip arm in `openrouter-chunk-scan.ts` was unreachable,
a `startsWith('{')` gate dropping every input that could fail the guard
(a `{`-opening payload `JSON.parse` accepts is always a record),
so the gate came out
and a whitespace-prefixed object it used to drop is read now;
the endpoint spread's unreported arm folded into the seam;
the `/credits` non-success refusal got its case,
throwing the shared HTTP failure class.
Two by-position comments and one statement TSDoc the source scans flagged
came out with `780e4d267`.
The reach census (`~/temp/agent/mimo-trial/reach-openrouter2.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and the three edited sources "loaded it and left 0 cold stretches".
No B entry found.

The ninth cluster of that census,
`synthetic`,
against `census-xB1R6c` at `e7acc45c8`:
9 stretches over `synthetic-quota.ts` and `synthetic-transport.ts`
(`eca4d6e9f`).
Seven are `QuotaShapeError` field refusals in `parseQuotaSnapshot`,
all reachable from a malformed `/quotas` body,
cased in four:
the body parsing to a JSON array where the object goes,
the weekly block arriving as a string,
each mistyped five-hour field
(`max`,
`limited`,
`nextTickAt`)
and each mistyped weekly field
(`percentRemaining`,
`nextRegenAt`),
every one naming its own field in the refusal message.
Two are the `maxAnswerChars` and `wireFormat` conditional spreads
`fetchTransport` passes into `drainBody`,
cold on their present arms:
one case raises the drain's overrun on an answer past a caller bound,
one reads an anthropic-shaped stream when the exchange names its wire
format
and carries its control half,
the same body unnamed completing untouched
since an anthropic frame holds no `choices` key for the default scanner.
Nothing came out as unreachable.
The reach census (`~/temp/agent/mimo-trial/reach-synthetic.log`)
reads `ran 9, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The tenth cluster of that census,
`inspect`,
against `census-8aKVkN` at `5e5616dec`:
8 stretches over `inspect-paragraph.ts` (`f8cf67026`).
Three are `atomsOfNode` arms,
one case carrying an image and a resolved reference together
(the `image-url` and `reference` atoms)
and one carrying formatting spans,
which hold no atoms themselves and pass the walk through
their children's numbers
(the fall-through arm).
Three are refusals:
the strict-grammar catch and its first `unparseable` rejection
cased with an unclosed JSX tag,
and the definitions-parse rejection cased with a paragraph that parses
alone and refuses beside broken definitions.
One was the second `not-one-paragraph` check,
dead behind the first one's kind half
(its own comment:
the structure check already proved the shape):
a probe over five one-paragraph texts and twenty-one definition shapes
never fired it
(`~/temp/agent/mimo-trial/inspect-probe.mjs`),
and a block appended after a blank line cannot move the first block's
kind,
so the first check proves only the one-block shape
and the leading-block check reads the kind off the definitions parse,
its rejection left live and cased with a single heading.
The last is `gateParagraphRewrite`'s base rejection,
cased beside its candidate twin.
The reach census (`~/temp/agent/mimo-trial/reach-inspect.log`)
reads `still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The eleventh cluster of that census,
`corpus-run/tag`,
against `census-E0TzdR` at `f7f3b7665`:
8 stretches over `corpus-run/tag-attributes.ts`
(`a0d13daf7`,
`71c58938b`).
The module carried no test of its own,
sitting on the own-unit-tests allowlist;
the new `corpus-run/tag-attributes.unit.test.ts` leaves it,
`readTags` exported through `corpus-barrel` for the built-artifact tests.
Five cases map the eight:
a name cut off at the text's end
(both scan loops running off their ends
and the unclosed-tag return),
a bare attribute with no equals
(the tag reads and the name alone stays out,
a name alone stating no value),
an attribute starting where no name may,
an unquoted value,
and an unterminated quote,
each refusal case keeping the readable tag before the failing one as its
positive control.
The reach census's `cold since then` reading named one more
(`71c58938b`):
the first-letter refusal,
every other suite file reaching it and these files not.
The reach census (`~/temp/agent/mimo-trial/reach-tag2.log`)
reads `ran 8, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The twelfth cluster of that census,
`corpus`,
against `census-6x3Blt` at `6f70bdb9e`:
8 stretches over `corpus-source.ts` and `corpus-name-index.ts`
(`33fc7a459`,
`6046af7be`,
`0c0b80bd9`).
Five are cased through the public surface:
three cause-shape arms of the failure classifier
(a cause that is no object,
or null,
or carries no stderr classifies `other`)
and both unreadable-stderr arms of the stderr reader
(a string stderr reads its text so a missing-object phrase lands on the
kind,
a stderr that is neither buffer nor string reads as none)
through the `CorpusReadError` constructor,
the no-renderings skip and the length gate of the name index
(a translation declaring no forms contributes nothing;
one-code-point and twenty-five-code-point forms index nothing),
and the name index's catch rethrow
(a failure that is no missing object propagates)
through its injected reader.
One was the `gitOutput` catch rethrow,
dead behind nano-spawn's `getErrorInstance` wrapping
every throwable as `SubprocessError`;
the catch now wraps every throwable
as the sibling `readCorpusBytes` catch already did,
the tradeoff recorded under "Decisions for the owner to review".
The reach census's whole-file reading named two more along the way
(`6046af7be`,
`0c0b80bd9`):
the byte reader's body and its failure wrap,
both with their own cases now
(the CRLF page's bytes untouched at the pin,
the absent byte path naming `missing-object`).
The reach census (`~/temp/agent/mimo-trial/reach-corpus3.log`)
reads `ran 3, still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The thirteenth cluster of that census,
`coverage`,
against `census-MBzNhP` at `5a7a5029c`:
8 stretches over `coverage-candidates.ts`,
`coverage-wire.ts`,
`coverage-stage.ts` and `coverage-tail.ts`
(`c9b1940fe`,
`0f65e1f55`).
Two `unreachable:` index guards in the candidate lister came out for
`nonNullishOrThrow`
(the matcher and the aligner name sections inside their own inputs).
Four are the coverage wire's refusals,
one case reading them all
(a reply that is no record,
or whose quote,
reason or coverage is no string).
One is the stage's `followupEvidence` spread,
one case driving it with the evidence and its control without,
the asked sheet carrying the `PRIOR UNRESOLVED VERDICT` JSON only in the
first
(the `scriptedClient` grew an `asks` sink,
the consolidate-driver fixture's shape).
One was `targetSize`'s insertion guard,
dead behind `isPaired`'s own filter
(an insertion's text is empty by `makeInsertionChunk` anyway),
removed with no case.
The reach census's `cold since then` reading named two of the same family
(`0f65e1f55`):
the `identityContext` and `foreignRegions` spreads,
each cased with its control
(the identity context rides the sheets where handed and not where not;
a partial quote anchored in a region the pairing assigned to another
original reads misattributed and names the quote).
The reach census (`~/temp/agent/mimo-trial/reach-coverage3.log`)
reads `ran 5, still cold 0, cold since then 0, not loaded 0`
and the two edited sources "loaded it and left 0 cold stretches".
No B entry found.

The fourteenth cluster of that census,
`markup`,
against `census-uyG0kG` at `264a05cd9`:
7 stretches over `markup-atom-scan.ts` and `markup-atom-preservation.ts`
(`1136d5be0`,
`2fe92afcd`,
`27a8745bb`).
Four scanner refusals are cased in its case table:
an escaped close inside a matched region skipping to the real one,
a link destination unclosed at the newline,
an unterminated comment,
and a tag whose attribute expression never closes.
Two `?? ''` index fallbacks came out dead behind `scanMarkupAtoms`'s own
loop guard,
`at < text.length` holding at every read.
One `?.unexcused ?? []` fallback came out the same way,
dead behind the equal-length map of standings over deltas,
`nonNullishOrThrow` reading the delta.
`markup-atom-preservation` carried no test of its own
(the own-unit-tests allowlist);
the new file leaves it and grows through the reach runs
from three `settleMarkupMoves` cases to eight,
the later ones pinning the key reader,
the unexcused and gained pairing,
the same-kind re-mark,
the removable quote,
the copied-markup refusal
(a loss the source carries stays unexcused however the edit writes)
and the source-write pairing.
The reach census (`~/temp/agent/mimo-trial/reach-markup3.log`)
reads `ran 0, still cold 0, cold since then 0, not loaded 0`
and the two edited sources "loaded it and left 0 cold stretches".
No B entry found.

The fifteenth cluster of that census,
`refine`,
against `census-UCyK9F` at `3016312ec`:
7 stretches over `refine-eligibility.ts`,
`refine-wire.ts`,
`refine-stage.ts` and `refine-slice-settle.ts`
(`d8aea82b3`,
`0ddd86249`,
`7710497e2`,
`45f0eae68`,
`2e827df9c`).
Five are cased through the public surface:
the eligibility boundary's `not-body-zone` skip
(no parse reaches it,
a footnote definition parsing as one node the kind check refuses first,
so the case hands the boundary a paragraph in the footnote-definition
zone through the document parameter it takes),
a rewrite entry that is no record,
a rewrite writing the base back,
the neighbour spreads riding the damage probe
(a scripted flow reads the asked sheets:
the neighbour source and incumbent arrive together,
and neither where the slice stands alone),
and the identity and reference context spreads of both the stage and the
settle
(the checker tally case threading them through the recheck call).
The checker tally is cased with its control:
an accepted issue left open counts not-worsened where no tally speaks,
and the slice rolls back where one checker verdict says worse.
Two were unreachable behind their callers' own contracts:
`resolveRefineRewrites` binds an operation only to an envelope it found,
so the stage's envelope lookup came out for `nonNullishOrThrow`;
and the checker stage builds one tally per issue asked and
`nonNullishOrThrow`-reads it for its own readings,
so the `?.worse ?? 0` fallback came out the same way.
The reach census (`~/temp/agent/mimo-trial/reach-refine4.log`)
reads `ran 2, still cold 0, cold since then 0, not loaded 0`
and the two edited sources "loaded it and left 0 cold stretches".
No B entry found.
B224 has since deleted the `not-body-zone` case,
which reached its arm through a cast,
and made the arm an `unreachable:` throw.

The sixteenth cluster of that census,
`corpus-run/window`,
against `census-koUGtg` at `87915c539`:
7 line stretches over `window-trial-ledger.ts`,
`window-trial-report.ts` and `window-trial-slice.ts`
(`349a41a08`,
`5997cef44`),
the probe's three named ones the never-called functions the census books
apart.
Three are cased:
the draw-and-preparation disagreement throw
(a slice index the prepared list does not carry),
both incumbent-kind arms of the trial
(a rendered slice beside an insertion one,
the translators' sheets showing the incumbent only in the first),
and a ledger line that parses as JSON but is no row
(the rows around it kept).
Three were the shipped sum's index fallbacks,
unreachable behind the fixed arm list that builds it,
now read through a named function with no indexing.
The `window-trial-slice` rig gained a ballot knob and a translator-sheet
capture for it.
The reach census (`~/temp/agent/mimo-trial/reach-window.log`)
reads `ran 4, still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The seventeenth cluster of that census,
`corpus-run/contributor`,
against `census-D1SlGz` at `a57969b33`:
7 stretches over `contributor-name-authorities.ts` and
`contributor-name-restore.ts`
(`b2a0f5395`,
`539a98d16`,
`bcdd232b2`).
Five are cased:
the page-rendering fallback
(a new `contributor-name-authorities.unit.test.ts` leaves the
own-unit-tests allowlist,
`nameAuthorities` exported through `corpus-barrel`:
a page naming no section where the archive never rendered the handle
leaves it to its pinyin reading),
the name match on a heading titled outright with the signed name
(which also runs the colon-less prefix arms),
and a heading whose original names no contributor left alone.
The reach runs corrected three fixtures,
not code:
the authority derives from the signature,
the archive rendering returns before the page read,
and an uncarried page leaves the pinyin standing.
Two were the identical-line unchanged arms of the heading and signature
rewrites,
unreachable behind `carriesRendering`
(the name is the trimmed span and the written name the trimmed tail,
so an identical rebuild means the rendering is already carried),
removed (ledger M112's shape).
The last was the skip for a slice the replacements never wrote,
cased.
The reach census (`~/temp/agent/mimo-trial/reach-contributor5.log`)
reads `ran 1, still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The eighteenth cluster of that census,
`introduced`,
against `census-HKw9t2` at `de0c6777d`:
7 stretches over `introduced-defect-wire.ts` and `introduced-defect-screen.ts`
(`3af7885a8`,
`74490e7dc`,
`3094cc053`).
All cased,
none unreachable:
the verdict and report guards' non-record refusals
and the check guard's non-number region,
the two neighbour fallbacks
(one neighbour handed in,
the other block reading empty),
the empty-quote dismissal
(a claim whose quoted side flattens to nothing
can only reach the restates check through the damage gate,
so the case anchors on new wording and reads corroborated),
and the identity-context thread
(its rules ride the system half and gate on the context carrying a
`DECLARED NAMES` entry,
the case handing that shape beside a no-context run).
The reach census (`~/temp/agent/mimo-trial/reach-introduced3.log`)
reads `ran 7, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The nineteenth cluster of that census,
`image`,
against `census-mgeQC0` at `3df615eea`:
6 stretches over `image-asset.ts`,
`image-ocr.ts` and `image-reading-pair.ts`
(`167332775`,
`feada2f6e`,
`480561e23`).
Five are cased:
a name carrying no dot reads no extension
(`extensionOf` joined the barrel beside `encodeImageAsset`,
the gap its own file's header recorded),
the two decoder successes and the whole OCR read path
(tool-made fixtures,
the tools being the subject:
one picture falls to the fallback decoder and reads through tesseract,
one webp never leaves the first decoder,
and the fixtures carry a sentence rather than two words
because the textless line is `MIN_READING_CHARS`),
the deterministic count in the textless confirmation
(cased both ways),
and the reader-failure catch
(a picture wider than the reader processes,
and a reader binary not there at all,
the last through the reader name now being a defaulted parameter).
One was the could-not-name roster guard,
unreachable behind the capability gate:
every unnamed slot answers with a reading before any exchange,
so no rejected ask arrives at an unnamed position,
and the roster read is `nonNullishOrThrow`'s now.
The reach census (`~/temp/agent/mimo-trial/reach-image3.log`)
reads `ran 1, still cold 0, cold since then 0, not loaded 0`
and the two edited sources "loaded it and left 0 cold stretches".
No B entry found.

The twentieth cluster of that census,
`corpus-run/coverage`,
against `census-14CEcx` at `6d19de4cb`:
6 stretches over `coverage-control.ts`
(`c2c9c9689`,
`db979e5b3`).
All cased in the vote-change driver file:
the not-carried refusal
(a verdict that never claimed a rendering),
the evidence-not-locatable refusal
(the cut emptying the translation;
renamed `cut-left-nothing` on 2026-10-05,
ledger B149),
the no-room decoy
(a quoted rendering filling all but one character,
which left two,
ledger B150,
the no-room reading riding its row),
and the held pair through a client whose vote follows the quote
(the wire's rule that a `none` claim carries an empty quote
doing the pairing),
with the unchanged-vote case beside it.
The reach census (`~/temp/agent/mimo-trial/reach-coveragecontrol.log`)
reads `ran 6, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The twenty-first cluster of that census,
`corpus-run/rendering`,
against `census-Vv2d8g` at `c7b022978`:
6 line stretches over `rendering-audit-settled-buy.ts`,
`rendering-audit-settled-subject.ts`,
`rendering-audit-settled-input.ts` and `rendering-audit-settled-runs.ts`
(`bce653c57`,
`b01ca171a`,
`be9beb63c`).
Four are cased:
the empty identity declaration,
the missing-comparison-row invariant
(a delivered slice the comparison rows never named),
the verify refusal
(a recorded `sourceChars` the preparation does not measure),
and the slot phrase read in both its numbers
(one slot and two,
a matched slot whose text one run never recorded).
Two were settled behind their own contracts:
the decided filter now carries the narrowing as a type predicate
(its re-check throw gone,
its comment naming `asSubject` after the position scan refused
"mapping below"),
and the cited-pages map being total over the subjects
makes its miss guard `nonNullishOrThrow`'s
(the refine batch's shape).
The reach census (`~/temp/agent/mimo-trial/reach-rendering2.log`)
reads `ran 2, still cold 0, cold since then 0, not loaded 0`
and the two edited sources "loaded it and left 0 cold stretches".
No B entry found.

The twenty-second cluster of that census,
`sample`,
against `census-u4yVLi` at `4a5f94f64`:
6 line stretches over `sample-draw.ts`,
`sample-grading.ts` and `sample-manifest.ts`
(`a23270119`,
`c3c0ac7c2`,
`1ecdd31b7`,
`5dbdff239`).
Four are cased in their own files
(a new `sample-draw.unit.test.ts` leaves the own-unit-tests allowlist):
the round-robin quota fill,
the comparator's entry-shuffle tiebreak
(pinned with both arrival orders under a seed that puts the
later-alphabetical entry first),
the byte-count assertion's refusal,
the uncategorized and no-summary placeholders
where the issue names no claim,
the repair context carried where the issue has one,
and a manifest whose generation says it is unrecorded.
Two were settled behind their own contracts:
the quota loop's no-progress break
(a stopgap behind the `Math.min` cap the function takes)
became a pass ceiling,
the termination proof now structural;
and the comparator's issue-key tiebreak was dead twice over
(the rank is the issue-shuffle order,
and equal entry keys mean one entry twice),
the entry-shuffle compare alone remaining.
The reach census (`~/temp/agent/mimo-trial/reach-sample6.log`)
reads `ran 4, still cold 0, cold since then 0, not loaded 0`
and the edited source "loaded it and left 0 cold stretches".
No B entry found.

The twenty-third cluster of that census,
`line`,
against `census-8QcZ0L` at `7acd7e8a1`:
6 line stretches over `line-structure.ts` and `line-structure-guard.ts`
(`fe1f48671`,
`76f87ac7b`,
`5202dedc5`).
Three are cased:
the bilingual pair in both language orders
(the English-first shape through its own case),
the no-letter neighbour that pairs with nothing
(so merging the two stays a fault the pairing never excused),
and the page bound
(a rendering carrying the pair's English more times than the page does).
Three read strictly now:
the median's zero fallback sat behind the five-block floor
and the paired-line reads behind the loop bound,
all three `nonNullishOrThrow`'s
(the refine batch's shape).
The reach census (`~/temp/agent/mimo-trial/reach-line2.log`)
reads `ran 0, still cold 0, cold since then 0, not loaded 0`
and the two edited sources "loaded it and left 0 cold stretches".
No B entry found.

The twenty-fourth cluster of that census,
`corpus-run/directory`,
against `census-eIzZ5P` at `328486494`:
6 line stretches over `directory-id-name.ts`
(`6ce30575c`,
`f2a9a055b`).
All cased:
front matter that is no record reads no name and no alias,
a name that is no string names nobody,
an info block that is no record names no id,
the alias list stands when its entries spell the id
(and neither text nor list names nothing),
an id of punctuation carries no letters to spell
(the source carrying no alias at all,
since the alias path's empty-vs-empty comparison stands first),
and the id-namer answers for the visible name.
The reach census (`~/temp/agent/mimo-trial/reach-directory2.log`)
reads `ran 6, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The twenty-fifth cluster of that census,
`corpus-run/consolidate`,
against `census-xreqy1` at `372848f72`:
6 line stretches over `consolidate-cache-store.ts`
(`445e5b718`).
All cased through the store's own round trip:
a gate ballot that is no record,
a ballot whose unsupported rendering names no choice the gate knows,
a slate floor that is no record,
a gate outcome that is no record beside the absent one the floor leaves
standing,
both shippings the gate names
(consolidated and standing),
and a settlement that is no record at all.
The reach census (`~/temp/agent/mimo-trial/reach-consolidate.log`)
reads `ran 6, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The twenty-sixth cluster of that census,
`corpus-run/list`,
against `census-RRFnX2` at `8fefdc00c`:
6 line stretches over `list-spread-restore.ts`
(`45e3356bc`,
`99058e60a`).
Two closed by narrowing:
the gap walk's earlier-extent fallback
(a `??` over an index its own map guarantees)
and the archive lookup's undefined check
(the counts had already been compared),
both `nonNullishOrThrow`,
their own comments already arguing the values are present.
Two cased:
a single-item list carrying no gap to space,
and a slice whose list counts differ between the text it replaces
and the replacement
(the walk reads those two sides,
not the archive's source text).
Left:
the two missing-position refusals at the extents walk,
reached only where a parsed item carries no offsets.
The reach census (`~/temp/agent/mimo-trial/reach-list2.log`)
reads `left 2 cold stretches`,
those two.
No B entry found.

The twenty-seventh cluster of that census,
`preservation`,
against `census-g87Ji1` at `1c2219b35`:
6 line stretches over `preservation-tokens.ts`
and `preservation-check.ts`
(`05a02beab`).
The name scanner's five empty-string string-index fallbacks
(dead:
each guarded by its own bounds check)
became `nonNullishOrThrow`.
One cased:
a licensed quote that is empty blanks nothing,
since splitting on it would take the text apart character by character.
The reach census (`~/temp/agent/mimo-trial/reach-preservation.log`)
reads `left 0 cold stretches` on the edited source.
No B entry found.

The twenty-eighth cluster of that census,
`corpus-run/prose`,
against `census-OjpKcL` at `f9a3f7845`:
5 line stretches over `prose-ranges.ts`
(`55621aa6e`,
`1c59e999d`,
`943323375`,
`794cd7764`).
All cased:
the line-comment path reading its end at the line end or the text end,
an expression quoting with a backtick,
a code fence read to its closing fence,
a lone backtick pair read as no code-span end,
a marker that never closes read as running to the text end,
and a bare autolink read to its end mark.
The reach census over the corpus-run tests
(`~/temp/agent/mimo-trial/reach-prose8.log`)
reads `ran 5, still cold 0, cold since then 0, not loaded 0`.
No B entry found.
