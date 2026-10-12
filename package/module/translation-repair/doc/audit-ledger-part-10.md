# Audit ledger, part 10

Part 10 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Test suite, continued

### T8: code no unit test runs, continued

The twenty-ninth cluster of that census,
`corpus-run/probe`,
against `census-7LEx8b` at `be8df8b13`:
5 line stretches over `probe-telemetry-report.ts`,
`probe-relabel-case.ts`
and `probe-relabel-control.ts`
(`b37a5851f`,
`0176fa22d`,
`db84dbfa3`,
`5d817c448`).
All cased:
the telemetry report's degraded-editor and silent-refiner notes,
a manifest drawing an issue id no candidate carries,
one region taken per envelope
(a second of the same envelope would answer as its own control),
and a region the entry translation never held.
The fixtures are a throwaway corpus clone of invented cat pages,
a scratch run carrying entry artifacts built to the settled record shape,
and a manifest built through `buildSampleManifest`.
Four source scans named the patterns the new cases must keep
(`5d817c448`):
process-global writes run at `concurrency: 1`,
the `runsDirPointedAt` and `restore` bodies join their existing
global-writer groups rather than a shared fixture,
temp directories go through `scratchDir`,
and a module with its own test leaves the own-tests allowlist.
The reach census (`~/temp/agent/mimo-trial/reach-probe2.log`)
reads `ran 2, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The thirtieth cluster of that census,
`stage`,
against `census-1VGtcy` at `0cb2d46fa`:
5 line stretches over `stage-windowed-rounds.ts`,
`stage-roster.ts`,
`stage-fanout-window.ts`
and `stage-decision-call.ts`
(`6d45ab0a1`,
`4095f47e3`,
`e4f718feb`).
Four cased:
the roster reads no voices from a unit line carrying no heard pair,
the decision call loses its voice where the stage guard refuses
the reading,
the decision call throws where the signal aborted,
and both optional-knob spreads carry their field when set
(`maxAnswerChars` and `graceMs`)
and omit it when not.
One came out rather than a case:
the fanout content ternary's structured arm,
since `ChatMessage.content` is string-only
(`package/module/llm-type/src/message.ts:44`)
and the `JSON.stringify` arm was unreachable at the type level.
The reach census (`~/temp/agent/mimo-trial/reach-stage3.log`)
reads `ran 1, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The thirty-first cluster of that census,
`corpus-run/model`,
against `census-WleNhT` at `3788b184e`:
5 line stretches over `model-catalog-compare.ts`
(`013e5d3ff`,
`581363446`).
All cased:
a models body and an entry that are no object
(both `ArtifactParseError` refusals),
the claimed-underlying read under either spelling
(hf-prefixed and plain),
and the catalog report:
the owner blocklist under both spellings,
the unlisted model it does not block,
the missing model's 404 line,
and the alias onto a claimed underlying.
The reach census (`~/temp/agent/mimo-trial/reach-model2.log`)
reads `ran 5, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The thirty-second cluster of that census,
`corpus-run/bench`,
against `census-WGrBjo` at `eb21c9e1e`:
5 line stretches over `bench-report.ts`
(`2810a9104`).
Two closed as unreachable:
the middle-width fallback
(a `??` over an index the empty-widths throw already guards)
became `nonNullishOrThrow`,
and the `describeRows` empty-rows note came out
(its one caller groups non-empty lists).
Two cased:
the middle width read as the repeat beside the empty-roster refusal,
and the token sums of every call a row made
(through the captured report output).
The reach census (`~/temp/agent/mimo-trial/reach-bench.log`)
left one cold stretch in the focused run,
none in the whole-suite census
(`census-G4ZkGi` lists no `bench-report.ts` stretch).
No B entry found.

The thirty-third cluster of that census,
`grade`,
against `census-G4ZkGi` at `9e92cf00f`:
5 line stretches over `grade-agreement.ts`
and `grade-sheet-read.ts`
(`894ef4d0c`,
`dd52f9ced`,
`df2c9a7f4`).
One closed as unreachable:
the no-marker arm of the answer reader,
whose item filter already keeps only lines carrying the marker.
Four cased:
an answer no legend bounds
(the whole rest of the line),
an answer opening on the duplicate word,
a pre-grade whose verdict is no string
(the vocabulary refusal),
and the duplicate indices listed beside the rates.
The reach census (`~/temp/agent/mimo-trial/reach-grade3.log`)
reads `left 0 cold stretches` on the edited source.
No B entry found.

The thirty-fourth cluster of that census,
`restoration`,
against `census-RD9far` at `36b501c3b`:
5 line stretches over `restoration-judge-wire.ts`
and `restoration-judge.ts`
(`e16e16184`).
All cased:
a reply and a judgment that are no object,
a reference that is no number,
a duplicate judgment on one reference,
and a ballot naming one seed only counted on that seed.
The reach census (`~/temp/agent/mimo-trial/reach-restoration.log`)
reads `ran 4, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The thirty-fifth cluster of that census,
`han`,
against `census-AwkhvA` at `ad2cc341b`:
5 line stretches over `han-only-text.ts`
and `han-title-read.ts`
(`3948763a2`).
All cased:
an empty string read as no character,
the ASCII-letter walk both ways,
a linked title read down to its text beside a linkless bracket
read whole,
and a title skipped for a line end or a repeat.
`carriesAsciiLetter`
and the title readers join the text barrel so the cases reach them.
The reach census (`~/temp/agent/mimo-trial/reach-han3.log`)
reads `still cold 0` on the five,
with `carriesHan`'s walk cold since then in the focused run
and none in the whole-suite census
(`census-4VTupe` lists no `han-only-text.ts` stretch).
No B entry found.

The thirty-sixth cluster of that census,
`corpus-run/cap`,
against `census-4VTupe` at `351bb15dc`:
5 line stretches over `cap-census-read.ts`,
`cap-census-rule.ts`
and `cap-override.ts`
(`a5a9c4ab3`,
`9b1240f9a`,
`3af9376a5`).
Three closed as unreachable:
the stamp split's empty fallback
(both line markers carry the bracket it splits on),
the paired stream's content fallback
(the index comes from the queue itself),
and the P99's zero
(the per-model group guard skips empty groups
before the percentile runs),
all three `nonNullishOrThrow`.
Two cased:
a malformed stamp read as unstamped
beside a wrong unit word read as an other line
and a stream carrying no content count pairing to none,
and the hard-cap variable read from the environment
when the caller names no raw text.
The reach census (`~/temp/agent/mimo-trial/reach-cap3.log`)
reads `left 0 cold stretches`.
No B entry found.

The thirty-seventh cluster of that census,
`corpus-run/published`,
against `census-HQOwnq` at `af80f65bc`:
5 line stretches over `published-page-disagreement.ts`
and `published-page-check.ts`
(`13a1780c9`,
`2b3d73ec6`,
`39b9c1be1`).
Landed:
the disagreement path driven over an artifact shipping two slices
where the stored archive carried one
(the second fills an anchor),
and the weigh and wording checks driven directly over the same
mismatch beside an anchor slice.
Left:
the three incumbent-map fallbacks
(`179`,
`196`,
`236`)
and the unweighable return
(`552`).
The map is built from the artifact's own comparison rows,
so a key miss needs a comparison and would-ship divergence
the fixture builders do not expose;
the empty-incumbent shape they do expose is covered.
The reach census (`~/temp/agent/mimo-trial/reach-published3.log`)
reads `still cold 4`:
those four.
No B entry found.

The thirty-eighth cluster of that census,
`edit`,
against `census-i9Duoq` at `7e809aa9e`:
5 line stretches over `edit-prompt.ts`
and `edit-wire.ts`
(`527789637`).
One closed as unreachable:
the listed-names join's last-name fallback
(a `??` over an index the two-name minimum guarantees).
Three cased:
the neighbouring block read with either half alone,
and a reply and an edit that are no object.
Left:
the single-name join
(`edit-prompt.ts:89-90`),
whose listed names shrink below two only for an issue
touching one identifier kind,
and the issue fixtures for that are the deeper suite's.
The whole-suite census (`census-1iMkkv`)
lists that one stretch for the file.
No B entry found.

The thirty-ninth cluster of that census,
`corpus-run/spend`,
against `census-1iMkkv` at `6148ad0ce`:
5 line stretches over `spend-read.ts`
(`07d5f9647`).
All cased:
a first field naming no record
(`not-a-record`),
a negative count,
and a record missing its prompt or its completion
(`unreadable`),
each read off a logged SPEND line.
The reach census (`~/temp/agent/mimo-trial/reach-spend.log`)
reads `ran 3, still cold 2`
(`238`,
`345`),
but a direct probe of the four refusals
(`~/temp/agent/mimo-trial/spend-arm-probe.log`)
shows each arm's own value returning,
so the two lines' stretches are the census's attribution
rather than unrun code.
No B entry found.

The fortieth cluster of that census,
`corpus-run/editor`,
against `census-fUfTA1` at `6babe5a0d`:
13 line stretches over `editor-standing-read.ts`
(`26b7b7909`,
`df9436878`,
`41726bb37`),
all cased
(the missing run directory named on the error stream,
an artifact whose chunks the schema predates counted as
earlier-schema,
one naming a model the roster dropped named on the error
stream,
one naming a seated model read and reported,
and the runs variable read where the line names no directory);
plus the contest's none seat
(`637c54309`)
and the width report's neither-shipped row
(`5b0bf4d57`).
The settled-artifact fixture follows the schema walk
recorded in the handover.
Left:
the width input's envelope and ready returns
(`editor-width-input.ts:221-254`),
whose claims pass through the screen's own claim schema
before they reach the envelope derivation,
one more read away than this pass budgeted.
The reach census (`~/temp/agent/mimo-trial/reach-editor4.log`)
reads `ran 13, still cold 0` for the standing reader.
No B entry found.

The forty-first cluster of that census,
`corpus-run/roster`,
against `census-IjEvWX` at `e34945b80`:
4 line stretches over `roster-card-render.ts`
(`e1ee49e95`).
All cased:
the body read as the row array itself,
a modalities field that is no array,
the vision flag read as a boolean and left unlisted otherwise,
and a bedrock listing read as the bare fields it names.
The reach census (`~/temp/agent/mimo-trial/reach-roster.log`)
reads `ran 4, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The forty-second cluster of that census,
`corpus-run/handle`,
against `census-c2UUBT` at `64b7cc8f7`:
4 line stretches over `handle-gloss-place.ts`
and `handle-reading.ts`
(`216e4986d`,
`2db4930ee`).
One closed as unreachable:
the placement walk's slice-text fallback
(the texts map and the appearance walk share one replaced set).
Three cased:
a parenthesis that is unclosed or holds a line end,
a handle embedded in a word,
and a rendering whose parenthesis opens with no space before it.
The reach census (`~/temp/agent/mimo-trial/reach-handle2.log`)
reads `left 0 cold stretches`.
No B entry found.

The forty-third cluster of that census,
`corpus-run/slice`,
against `census-1UFhGm` at `717eb945f`:
4 line stretches over `slice-cache-namespace.ts`
and `slice-census-entry.ts`
(`5bf207307`,
`3fdbf9b19`).
One closed as unreachable:
the block-char read's missing-node fallback
(the walk indexes the node list it aligns).
Three cased:
a cache file whose JSON is no record recomputes,
a file that will not read surfaces its fault,
and the census entry counts the blocks
the translation carries and the source does not.
The reach census (`~/temp/agent/mimo-trial/reach-slice2.log`)
reads `still cold 2`
(`266`,
`378`):
both are the single-line return and throw
the census's attribution leaves cold
(the same reading the spend batch recorded),
and both cases assert their behavior directly.
No B entry found.

The forty-fourth cluster of that census,
`provider`,
against `census-cQ5IKo` at `f5ad2832f`:
4 line stretches over `provider-budget-refusal.ts`
and `provider-router.ts`
(`f8598d546`).
Three cased:
a failure that is not a provider reply
reading as no payment refusal and no stated wait,
and every provider refusing every attempt
reraising the last refusal.
The loop-exhausted throw its comment marks unreachable
(`provider-router.ts:543-549`)
stays as written.
The reach census (`~/temp/agent/mimo-trial/reach-provider.log`)
reads `ran 2, still cold 0, cold since then 0`
on the two refusals,
with one budget line cold since then in the focused run.
No B entry found.

The forty-fifth cluster of that census,
`corpus-run/runs`,
against `census-pVW4Um` at `34c05eb80`:
4 line stretches over `runs-lock-holder.ts`
and `runs-lock.ts`
(`4e95c885d`).
Two cased:
the lock line writes the holder's named fields alone
where its identity is unrecorded,
and the race loss names the holder it read back
(the error's shape with a holder).
Left:
the unrecorded identity construction
(`runs-lock.ts:250-251`,
its reads fail only where the host exposes none)
and the race branch's holder spread
(`runs-lock.ts:311`,
whose two-process race the single-process fixture
cannot stage without flakiness).
The reach census (`~/temp/agent/mimo-trial/reach-runs.log`)
reads `still cold 2`:
those two.
No B entry found.

The forty-sixth cluster of that census,
`transient`,
against `census-KYvmuo` at `38cb6b1e8`:
4 line stretches over `transient-retry.ts`
(`c1b403b95`).
One cased:
a thrown value that is no Error wraps into one
(the value thrown from an unknown-typed name
so the lint reads no literal non-Error shape).
Left:
the backoff's non-abort rethrow
(`225`,
reachable only where the wait itself faults),
the aborted-exchange pair
(`580-583`),
and the retry loop's exhausted throw
(`584-585`,
its own comment marks it unreachable).
The commit message for `c1b403b95` names only two of
the three left
(the aborted-exchange pair went unnamed);
recorded here rather than amended
(ledger GCA).
The reach census (`~/temp/agent/mimo-trial/reach-transient.log`)
reads `ran 1, still cold 3`:
those three.
No B entry found.

The forty-seventh cluster of that census,
`active`,
against `census-Kyrgyt` at `1f8e4b856`:
4 line stretches over `active-footnote-markers.ts`
(`4a87b3658`,
`6fc0fd2a4`).
Landed:
the run-bounding case whose paragraph holds
one untokenized autolink literal and nothing else,
so the run bounds at both ends of its parent's children.
Left:
the four bounds arms
(`309-310`,
`315-316`,
`328-329`,
`334-335`).
The autolink transform never produced a run
whose parent holds only unpositioned children
in these fixtures,
and the walk is footnote-scoped,
so the case's literal paragraph sits beside the marker
without its own run.
The reach census (`~/temp/agent/mimo-trial/reach-active2.log`)
reads `ran 0, still cold 4`:
those four.
No B entry found.

The forty-eighth cluster of that census,
`declined`,
against `census-PGu68D` at `ea2437490`:
4 line stretches over `declined-target-runs.ts`
(`3326ef801`).
Landed:
the empty-pairing case
(a pairing that placed nothing declines nothing).
Left:
the rendering-continue mark
(`109`),
the empty-pairing refusal's own line
(`158`,
the case's empty input exits through the guard before it),
and the node-read ternary arms
(`193-194`,
`195-196`).
Their step shapes need alignments producing continuations
the pairing fixtures do not yet stage.
The reach census (`~/temp/agent/mimo-trial/reach-declined.log`)
reads `ran 0, still cold 4`:
those four.
No B entry found.

The forty-ninth cluster of that census,
`displacement`,
against `census-vlck42` at `4bc9dbb79`:
4 line stretches over `displacement-class.ts`
(`f7fa3843e`,
`70ab0cae0`,
`1160a11a8`).
Three closed as unreachable:
the relocation surplus,
the target-only slice,
and the slice class,
all three reads their own comments mark as known present
(the index came from the readings,
the classes map built one entry per reading).
One cased:
a high slice whose neighbour's give-up
is far below the surplus's conserved fraction
pairs with nothing.
The reach census (`~/temp/agent/mimo-trial/reach-displacement2.log`)
reads `left 0 cold stretches`.
No B entry found.

The fiftieth cluster of that census,
`corpus-run/name`,
against `census-E2Gm5a` at `a070873af`:
4 line stretches over `name-gloss-restore.ts`
(`1daaca6e1`,
`f29a7247c`).
Two cased:
a gloss line whose quote never closes,
and one whose name is not followed by the gloss verb.
Landed but not reached:
the comma-separated gloss case
(`f29a7247c`'s shape missed the tail check's comma arm).
Left:
the comma arm
(`247`)
and the archive-slice map fallback
(`312`).
The reach census (`~/temp/agent/mimo-trial/reach-name2.log`)
reads `ran 2, still cold 2`:
those two.
No B entry found.

The fifty-first cluster of that census,
`corpus-run/canadian`,
against `census-E4DYQO` at `5bad15aa9`:
4 line stretches over `canadian-date-parts.ts`,
`canadian-date-read-leading.ts`
and `canadian-spelling-capital.ts`
(`10210a333`).
All cased:
a date whose year is too short
(the year drops and the day-month reorders),
one whose sentence names no year,
a sentence running on past its year
(the year set off on both sides),
and a stray underscore outside any emphasis.
The reach census (`~/temp/agent/mimo-trial/reach-canadian.log`)
reads `ran 1, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The fifty-second cluster of that census,
`mask`,
against `census-4BqrOY` at `ccc45bd68`:
4 line stretches over `mask-invisible-lines.ts`
and `mask-container-tags.ts`
(`29326895e`,
`d4a3c3c65`).
Two closed as unreachable:
the character's code point
and the line's start offset,
both reads their own walks guarantee.
Two cased:
a tag name starting with no letter
and a closer carrying anything past its name,
both reading as no tag
(the fixtures are lone tag lines,
the only ones the line filter keeps).
The new `mask-container-tags` unit file takes the module
off the own-tests allowlist,
and `maskLoneContainerTags` joins the index exports.
The reach census (`~/temp/agent/mimo-trial/reach-mask2.log`)
reads `left 1 cold stretch` for `mask-invisible-lines.ts`
in the focused run,
and the whole-suite census lists none for it
(`census-g0gs4w`).
No B entry found.

The fifty-third cluster of that census,
`source`,
against `census-oVnawX` at `f232ce389`:
4 line stretches over `source-only-breaks.ts`
(`250da1333`).
All four closed as unreachable:
the break-count fallbacks
(the breaks arrays are built one entry per block
at the same indices the walks read back).
Left:
the sumOwed reduce's other-kind arm
(`source-only-breaks.ts:188`),
whose fixture needs blocks of more than one kind
in one reduction.
The reach census (`~/temp/agent/mimo-trial/reach-source.log`)
reads `left 3 cold stretches` in the focused run
(the baseline's lines had moved),
and the whole-suite census lists one
(`census-ceHkbQ`).
No B entry found.

The fifty-fourth cluster of that census,
`corpus-run/cache`,
against `census-ceHkbQ` at `7f73d1ed7`:
3 line stretches over `cache-account-read.ts`
and `cache-account-slices.ts`
(`4d5c7d96e`,
`14a44721c`).
One cased:
the declaration name whose tail runs to its line end
(the suffix scan's whole-length arm),
the name then dropped for not ending in the marker.
The reach census (`~/temp/agent/mimo-trial/reach-cache2.log`)
reads `ran 1, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The fifty-fifth cluster of that census,
`hyper`,
against `census-bOt8GY` at `5c321a8d6`:
3 line stretches over `hyper-client.ts`
(`309cafca9`).
All cased:
the per-exchange deadline and the answer-length knob
carried on the request when the caller sets them
and omitted when it does not
(the knob rides the transport request,
read off the recorded exchanges).
The reach census (`~/temp/agent/mimo-trial/reach-hyper.log`)
reads `ran 3, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The fifty-sixth cluster of that census,
`model`,
against `census-pN6fUe` at `77e29656d`:
3 line stretches over `model-card-derive.ts`
and `model-content.ts`
(`cb4b07506`).
One cased:
the fence line with no line end after it
(the whole text is the opening line).
Left:
the two RangeError guards
(`model-card-derive.ts:366`,
`421-427`,
the keys-repeat and cards-and-lists-disagree refusals),
whose builders take their keys from the roster lists
and need a fixture disagreeing with them.
The reach census (`~/temp/agent/mimo-trial/reach-model2.log`)
reads `still cold 1`
(`model-content.ts:36`):
the single-line return the census's attribution leaves cold
(the case asserts its value directly).
No B entry found.

The fifty-seventh cluster of that census,
`container`,
against `census-VzG5Wr` at `1149ff79c`:
3 line stretches over `container-integrity.ts`
and `container-half-pairs.ts`
(`4621ad099`).
One closed as unreachable:
the opening-half read's undefined guard
(the partner index comes from the same list's find
and is checked against not-found first).
Left:
the nameless-container arm
(`container-integrity.ts:150-151`)
and the half-tag integrity error
(`263-266`),
whose fixtures need a container with no name
and a block cutting one tag.
The reach census (`~/temp/agent/mimo-trial/reach-container.log`)
reads `ran 0, still cold 2`:
those two.
No B entry found.

The fifty-eighth cluster of that census,
`corpus-run/dropped`,
against `census-MkpU3W` at `d4822f994`:
3 line stretches over `dropped-destinations.ts`
(`b55509754`).
Landed:
the run case shedding its sentence stopper
and reading several runs in order.
Left:
the earliest-reduce arm
(`187`),
the run-advance arm
(`241`),
and the stopper walk's return pair
(`292-295`):
the case's shapes did not reach them
(the run walk's arms need a run consuming nothing
and a trim walking to its first stopper).
The reach census (`~/temp/agent/mimo-trial/reach-dropped.log`)
reads `ran 0, still cold 3`:
those three.
No B entry found.

The fifty-ninth cluster of that census,
`lookup`,
against `census-5AHbot` at `e3c92742c`:
3 line stretches over `lookup-cache.ts`
(`a9b5e71dc`).
All cased:
a parsed value that is no object reads as no hit
and no record,
and a cache file whose JSON is no record is ignored as a miss.
The reach census (`~/temp/agent/mimo-trial/reach-lookup.log`)
reads `ran 0, still cold 3`:
the single-line returns the census's attribution leaves cold
(the cases assert their values directly).
No B entry found.

The sixty-first cluster of that census,
`retry`,
against `census-bppPVq` at `f254bb963`:
3 line stretches over `retry-stated-wait.ts`
(`e8636cf64`).
One closed as unreachable:
the digit walk's character read
(its loop bounds settle it).
Left:
the walk's return pair
(`143-145`)
and the gap's and-word arm
(`219-220`),
whose fixtures need a run ending at a non-digit,
one running to the text's end,
and a gap followed by `and `.
The reach census (`~/temp/agent/mimo-trial/reach-retry.log`)
reads `left 2 cold stretches`:
those.
No B entry found.

The sixty-second cluster of that census,
`corpus-run/lane`,
against `census-Fvq08a` at `196a32e66`:
3 line stretches over `lane-contest-cache-store.ts`
(`4fa547794`).
All cased:
an archive name that is absent or names either verdict
reads back,
and a value that is no record at all is refused.
The reach census (`~/temp/agent/mimo-trial/reach-lane.log`)
reads `ran 1, still cold 2`
(`59-60`,
`60-61`):
the OR chain's branches the census's attribution leaves cold
(the fourth instance of the pattern,
with the cases asserting their round trips directly).
No B entry found.

The sixty-third cluster of that census,
`corpus-run/reading`,
against `census-G1oD6W` at `503af2c3b`:
3 line stretches over `reading-cache-store.ts`
(`1fb9cb177`).
All cased:
a readings list that is no array,
an unavailable verdict whose kept readers are no array,
and one whose reason is no string,
each refusing to resume.
The reach census (`~/temp/agent/mimo-trial/reach-reading.log`)
reads `ran 3, still cold 0, cold since then 0, not loaded 0`.
No B entry found.

The sixty-fourth cluster of that census,
`nudged`,
against `census-GHsN0h` at `ec7cbfed3`:
3 line stretches over `nudged-reask.ts`
(`b487f4d02`).
Landed:
the second answer returned where it is usable
and the first where both fail,
the cases asserting the outcomes.
Left:
the two log fallbacks
(`147`,
`153`,
the servedBy-absent interpolation
the census's attribution leaves cold
for the fifth instance of the pattern)
and the abort rethrow
(`159`,
whose re-ask shape resolved rather than rethrew
in the fixture).
The reach census (`~/temp/agent/mimo-trial/reach-nudged.log`)
reads `ran 0, still cold 3`.
No B entry found.

The sixty-fifth cluster of that census,
`photo`,
against `census-pUl33e` at `9cb5622`:
3 line stretches over `photo-reference.ts`
(`8284b4b4f`,
`b5cae5d8a`).
Landed:
the unclosed-quote break cased,
the not-an-asset case,
and the odd-pair case.
Left:
the earlier-quote preference
(`133`)
and the not-an-asset arm
(`303`):
the cases' shapes did not reach them.
The reach census (`~/temp/agent/mimo-trial/reach-photo.log`)
reads `ran 1, still cold 2`.
The case's fixture note sat before an expect statement
as a TSDoc block (ledger B19);
fixed forward (`b5cae5d8a`).
No B entry found.
