# Audit ledger, part 27

Part 27 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B83: a heading restore that shipped a section the page never replaced as empty text

Found by T8's twentieth batch,
red in `66927af39`,
fixed in `339ce9118`.
`restoreCollidingHeadings` (`corpus-run/heading-collision-restore.ts`,
class forty-five)
paired the page's headings with the original's and the archive's by position across the whole page,
and checked only that the three totals agreed.
A replaced slice that drops its heading and another that gains one leave the totals equal,
while every heading between them sits one position off.
A slice the page never replaced then had its own heading compared with its neighbour's archive heading;
having no replacement,
its text fell back to the empty string,
and the restored row rides the override a trimmed slice does (`page-assembly-guard.ts`),
so the page would have carried that section as nothing,
with a finding claiming a restoration.
The probe through `guardPageAssembly`
(`b20-shift-probe.mjs` in the audit's scratch folder,
cat-themed)
printed the empty row before the fix and none after.

The restore now pairs by position only where every slice carries as many headings as its archive text;
anywhere else the page is left for the publish guard.
With every slice's count kept,
a slice the page leaves alone carries the archive's own headings at the archive's positions,
so it cannot collide,
and the fallbacks that guarded its absence throw (`nonNullishOrThrow`).

The pass also kept its own replacement-only map of page text,
apart from the contract `assembly-page-text.ts` states for every pass.
`a6edb4665` moves it onto `pageTextBySlice` and `withRewrittenText`,
and adds `pageTextOf`,
one reader of a slice's page text that refuses a slice the map was not built from
(`SliceNotOnPageError`,
`4c0039a57`,
naming the slice)
in place of eight reads in six modules,
six of which took a missing slice for empty text
and two of which already threw without naming the slice;
`70c8c8918` moves the last pass onto it.
No such read was reachable,
since each pass reads only the slices its map was built from.
The message of `a6edb4665` miscounted those reads as seven `?? ''` fallbacks,
and a commit comment on it corrects the count to eight reads in six modules.

Guard shown to fail:
with the per-slice count check disabled,
the case failed alone in its file.
With `pageTextOf`'s refusal disabled,
its own case failed alone in its file
and the B83 case still passed,
since the count check keeps the restore from asking.

### B84: heading passes that paired a slice's headings by position without checking the count

Found by T8's twentieth batch while reading B83's family:
the same pairing inside one slice.
Red in `26e24853e` and `3c35e130b`,
fixed in `57920abed` and `5f059feff`.

- `unifyHeadingSeries` (`corpus-run/heading-series-unify.ts`,
  class sixty-eight)
  numbered a slice's page headings from the original's numbered headings by position.
  A page slice that dropped its first heading gave the third section the second's number:
  `### Part Three: Snowy` shipped as `### Part Two: Snowy`.
  Reading the archive's style the same way,
  an archive slice that opens with an interlude heading of its own had that heading read as the series' third,
  so the archive seemed to use two styles and its own "Part" style was lost.
- `restoreContributorNames` (`corpus-run/contributor-name-restore.ts`,
  class sixty-seven)
  paired a slice's page headings with the original's titles by position,
  though it already refused to pair signatures where the counts differed.
  A page slice that dropped its first heading had the signer's name written over the next section's title:
  `### Four: Doggo` shipped as `### Four: Maomao`.

Each slice now joins the pairing only where it carries as many headings as the original's slice,
and is left as it stands otherwise.
`b20-series-probe.mjs` and `b20-contrib-probe.mjs` in the audit's scratch folder
printed the wrong rewrites before the fixes and none after.
The remaining positional pairings in the page passes already check their counts
(`contributor-name-authorities.ts` for signatures,
`archive-destination-restore.ts` for links,
`jsx-attribute-restore.ts` for tags,
`title-reference-unify.ts` and `heading-distinctness.ts` for headings),
by a search for position-indexed reads over `corpus-run/`.

Guards shown to fail:
with the page-side count check disabled,
the dropped-heading series case failed alone in its file;
with the archive-side check disabled,
the interlude case failed,
and four older cases threw,
since an archive slice that never headed its section now takes the same count check;
with the contributor heading check forced true,
its case failed alone in its file.

Measured while here:
`contributor-name-restore.ts` reads ATX headings only,
so a signer named in an HTML heading would never take the signer's rendering.
Over the 92 pinned originals
(`b20-html-signer-probe.mjs` in the audit's scratch folder,
ids and counts only),
13 HTML heading lines stand in 3 entries and none names one of its page's signers,
while 9 ATX headings do (all in XingZ60,
the positive control),
so the ATX-only reading misses nothing at the pin.

Calls made here are open to veto:

- a slice whose heading count moved is left as the page has it rather than paired by some other rule;
- the page-text reader throws a named refusal rather than reading a missing slice as empty text;
- `contributor-name-restore.ts` keeps reading ATX headings only,
  on the measurement.

Recurrence:
pairing items by position is sound only where both sides carry the same count at the level the positions are read;
`mistake-prevention.md`,
"Pairing by position".

### B85: an advancing withdrawal that compared refusal offsets on two different pages

Found by T8's twenty-first batch while reading the uncalled reducer in `assembly-structural-withdrawal.ts`,
red in `9c007f857`,
fixed in `a70c074a3`.
`advancingStructuralWithdrawal`
(class fifty-eight,
reached when no single withdrawal repairs the page)
read where the strict grammar first stops on the page as assembled,
then where it stops on the page with one replacement withdrawn,
and called the withdrawal advancing when the second offset was the larger.
The two offsets index two texts:
a withdrawal before the break changes the length of the text ahead of it,
so the same break sits at another offset without having moved.
A whole replacement 40 characters shorter than its archive text,
before two broken sections,
read as moving the first break 40 characters later,
ranked above the withdrawal that removed that break,
and the guard went on to withdraw all three replacements
(`b21-advance-red-probe.mjs` in the audit's scratch folder,
cat-themed).
The reducer that picks the furthest step had never run,
since every case gave one candidate;
this fixture gave two only through the defect.

`assembledOffsetOf` now maps a refusal on the withdrawn page back to the assembled one.
The two pages differ only in the withdrawn slice,
so a refusal in the shared text before it keeps its offset,
one in the shared text after it moves by the difference in length,
and one inside the slice's own archive text stands where the slice begins.
A withdrawal after which the grammar accepts the page is marked `cleared`
and outranks any that only moves the refusal,
since a grammar that stops at a page's very end
(an expression left open)
leaves the moved offset no later than the page's length.
The guard's finding names such a step as clearing the refusal.
The arms the mapping added are cased in `c17feba5b` and `9244d67d3`.

Guard shown to fail:
with the raw offset compared again,
both B85 cases failed,
and so did the direct B86 left-open case and the nothing-advances case,
each comparing offsets across a length change;
the B86 guard-level case passed.

The reducer still runs in no case.
After the fix,
two withdrawals both advance only where the parser carries state across slices,
so that one slice's text decides how another's is read
(an inference from the mapping:
a withdrawal elsewhere leaves the text around the break as it was).
No fixture built in this batch reached two candidates;
the reducer is kept,
reachable in principle by that route.

### B86: a strict refusal read at the start of what the parser left behind

Found by checking what B85's fix compares,
before it was written,
red in `3086d2ffe`,
fixed in `0e7353948`.
`strictRefusalOffset` names where the strict grammar stopped,
and `advancingStructuralWithdrawal` is its one reader.
It is also the one reader of `MdxParseError`'s `line` and `column`:
of the six other production sites holding a refusal
(`rg 'requireMdxRefusal' src`,
tests and fixtures excluded),
three read only its message,
which `mdxRefusalSite` writes from the parser's own place name and the fix leaves as it was,
one passes it on as a cause,
and two only narrow it.
`mdast-util-mdx-jsx` raises its refusals on leaving the span it names
(`onErrorRightIsTag` and `exitMdxJsxTag` in `lib/index.js`,
3.2.0):
an element left open in a paragraph is refused at the paragraph's end,
and one still open when the document ends is refused with no place at all.
`refusalPlace` read the message's `line` and `column`,
which a `VFileMessage` copies from the span's start,
and `strictRefusalOffset` read a refusal with no place as the start of the body.
On a page whose open element sat beside a broken expression,
the parser named the expression first;
withdrawing it left the open element,
read as offset 0,
so no withdrawal advanced and the guard withdrew every replacement
(`b21-b86-probe.mjs`,
printed `assembly-withdrew-every-replacement` on `a70c074a3`).

`stopPointOf` now reads the end of the span a message names,
or the point it names;
a refusal with no place reads as the end of the body.
Micromark's own refusals name a point,
and its columns count UTF-16 units as the offsets here do
(`b21-place-probe.mjs`:
a break after an emoji refuses at the offset its index gives).

Guards shown to fail:
with the position-less refusal read at the body's start again,
the document-end case and both left-open withdrawal cases failed;
with the span read at its start again,
the paragraph-end case failed alone.

Calls made here are open to veto:

- a refusal is placed where the parser stopped,
  the end of the span it names,
  not where the span begins;
- a withdrawal after which the page parses outranks any that moves the refusal,
  however far.

Recurrence:
an offset means something only in the text it indexes,
and a parser's position is where its message says it stopped;
`mistake-prevention.md`,
"Offsets and positions".

### B87: an Anthropic stream's ending read off a word, and its error event read as a cut stream

Found in T8's twenty-second batch,
reading `anthropic-completion.ts` against the current streaming documentation
(platform.claude.com,
"Event types"),
red in `57ffcf2dd`,
fixed in the commit adding this entry.
`requireAnthropicTerminator` counted a body as whole when any `data:` payload held the word `message_stop` in quotes.
A body cut inside its last frame,
after `{"type":"message_stop"` and before the closing brace,
passed:
the retry ladder (`wholeMessage` in `hyper-client.ts`) returned it,
and `extractAnthropicCompletion` then refused it as a frame that is not JSON,
after the ladder,
so the call was lost with retries left.
A frame holding that word as a value
(a tool's name)
passed too,
and on a stream cut before its end handed the fold half an answer.
The stream's error event,
which the documentation shows in place of the rest of a failing message,
was not read at all:
with no terminator after it,
the refusal named a cut connection;
with one after it,
the fold returned what came before as the answer.

`requireWholeAnthropicMessage` replaces it,
since moved with the frame reading into `anthropic-whole-message.ts`,
which has its own tests,
when the B89 fix took `anthropic-completion.ts` past the line limit.
Each payload is read as a frame by `readFrame`,
which the fold shares;
the terminator is a frame whose `type` is `message_stop`,
and an error event refuses the message wherever it stands.
The refusal names the error's type when that type is a protocol word
(lower-case ASCII letters and underscores,
at most 64 characters),
and "unnamed" otherwise,
since the error class promises to quote nothing from the body.

The B23 census of fixed-word searches listed this site
(`b23-needle-census.txt`,
`anthropic-completion.ts:428`)
and recorded no class for it.
Its quotes bound the word,
so as a word search it read as bounded;
the defect was of another kind,
a frame's type read off its text instead of its parse.

Calls made here are open to veto:

- only the ending is read before the ladder returns:
  a body whose terminator arrived was delivered whole,
  and a frame inside it that does not parse is refused by the fold,
  unretried,
  read as a formatting defect a retry would repeat and pay for again
  (an inference,
  not measured);
  `requireStreamTerminator`,
  the OpenAI-shaped sibling,
  reads the same scope;
- an error event is retried as a cut stream is.

Open when this entry was written,
closed in B202:
an error the provider calls `invalid_request_error` is retried as an overloaded one is,
spending attempts that cannot succeed.

Recurrence:
which frame a payload is gets read off its parse;
`mistake-prevention.md`,
"Structure read off the parse".

### B88: prompt tokens that left out the cache

Found in T8's twenty-second batch,
reading `foldUsage` against the prompt-caching documentation
(platform.claude.com),
red in `9a885953d`,
fixed in the commit adding this entry.
Anthropic's `input_tokens` counts only the tokens after the last cache breakpoint;
the documentation gives the prompt as `cache_read_input_tokens + cache_creation_input_tokens + input_tokens`.
`extractAnthropicCompletion` reported `input_tokens` alone as `prompt_tokens`,
so a call that read or wrote the cache was counted,
and priced,
as a short one.
The fold now keeps each usage field's last report (`USAGE_SERIES`),
a null read as absent,
and the prompt is the sum of the three.

Reach:
only `hyper-client.ts` calls this reader in production,
and Charm Hyper's captured stream (2026-08-24) carries no cache field,
so production counts do not move.
The one capture that does carry one is OpenRouter's Messages endpoint
(2026-09-03,
measurement only):
its expected prompt count moved from 574 to 702.
Whether that gateway's `input_tokens` already counts cached tokens was not settled:
today's DigitalOcean prices for the model matched neither reading of the capture's own cost.
The payload store keeps only the extracted counts,
so no stored reply carries a cache field to replay.
`corpus-run/hyper-price.ts` prices every prompt token at the input rate,
so a cached call is now over-estimated where it was under-estimated;
its cache rates are recorded and unused.

Calls made here are open to veto:

- the documented sum is followed,
  though the one gateway capture carrying a cache count could not be checked against it.

Recurrence:
a provider's field is read as its documentation defines it;
`mistake-prevention.md`,
"Provider fields read by their documentation".

### B89: Anthropic answer fragments dropped without a word

Found in T8's twenty-second batch,
reading the stretch census-lxT62v lists cold at `anthropic-completion.ts:242`
(a `content_block_delta` frame with no delta returned nothing)
against the streaming documentation,
red in `7b5a9d2ac`,
fixed in the commit adding this entry.
The documentation gives every `content_block_delta` frame a `delta`,
every `text_delta` a `text` and every `input_json_delta` a `partial_json`.
`foldDelta` passed over a frame with no delta,
and `stringField` read a text or `partial_json` that was not a string as empty,
so the answer came back with a piece missing and nothing said;
a prose answer missing words would then be judged and placed as whole.
The same reader refuses a frame that is not JSON,
on the grounds that the answer assembled from the rest is missing an unknown piece,
and a frame that parses but lacks its fragment is the same case.
Now `foldDelta` refuses the first,
and `answerFragmentOf` the second,
each with a `MalformedCompletionError` naming the field.
A delta of a type the fold does not read,
and one naming no type,
are still passed over:
either may be a type the provider added later,
which the documentation asks a reader to handle gracefully.

The B29 census of silent fallbacks read nullish fallbacks,
parameter defaults and caught errors;
a reader returning an empty string for a field of the wrong type is none of those,
so this file's `stringField` was not in its reach.

Recurrence:
a frame that parses but lacks the fragment its kind carries is refused as a frame that does not parse is;
`mistake-prevention.md`,
"Provider fields read by their documentation".

### B90: an Anthropic refusal that named the OpenAI-compatible contract

Found in T8's twenty-second batch,
in retry lines the unit suite logs
(`completion body violated the OpenAI-compatible contract: anthropic stream ended without message_stop`),
red in `0b9447b81`,
fixed in the commit adding this entry.
`MalformedCompletionError` worded every refusal as a breach of the OpenAI-compatible contract,
and the Anthropic readers throw it too,
so a failed Charm Hyper call read as a broken OpenAI-shaped body.
The note at the head of `completion-shape.ts` records an earlier fix to the same message:
a live log named Synthetic for a call that went to Charm Hyper,
and that fix took the provider's name out
but kept the contract,
which that Hyper call did not speak either.
The constructor now takes the wire format its reader read the body as
(`StreamWireFormat`,
required),
and the message names that format's contract;
the Anthropic details drop their own "anthropic" prefix,
which the contract now carries.

Recurrence:
a shared error class names what its thrower knows,
taken from the thrower;
`mistake-prevention.md`,
"Labels a message names".

### B91: a delta type the Anthropic scanner does not read, claimed as reasoning in a thinking block

Found in T8's twenty-second batch,
reading the stretch census-lxT62v lists cold at `anthropic-delta-scan.ts:450`
(`DELTA_TEXT_FIELDS.get(deltaType) ?? ''`),
red in `a1761139e`,
fixed in the commit adding this entry.
`channelFor` returned `reasoning` for every delta type inside a thinking block,
the types the scanner does not read included,
and the text was then read from the field the second table named,
or from the field named by the empty string where it named none.
A `signature_delta`,
which the streaming documentation sends at the end of every thinking block,
reached that fallback;
it yields nothing only because it carries no field named by the empty string.
The two tables were kept apart on a claim their own note made,
that one table could not hold two types sharing a channel under different fields;
a table of pairs holds them.
`DELTA_READINGS` now pairs each type's channel with its field,
and `routingFor` returns a type the scanner does not read as unread before a block can lend it a channel.
The same commit reads the scanner's held-back line with `nonNullishOrThrow`:
a split yields one piece at least,
so `lines.pop() ?? ''`,
cold at line 524 in census-lxT62v,
named a case that cannot happen.

Recurrence:
a table split in two lets one half answer where the other has nothing;
a note claiming a design is forced is checked against the smallest table that would hold it.

### B92: a JSON array read as a record

Found 2026-10-01 (UTC) by a census of `isJsonRecord`'s calls,
red in `ee6e5b1c5`,
fixed in the commit adding this entry.
`isJsonRecord` (`json-guard.ts`) answered true for an array,
and its TSDoc called that harmless:
"numeric-keyed probes simply miss".
The census read its 129 calls in 62 production files
and found 38 where an array let through changed what a reader did,
and none that needed an array to pass.
An array where a record belonged was read as
an Anthropic frame or delta naming no type and passed over uncounted,
a usage-only stream event,
a resumable slice or translate cache record and a settled consolidation round with no further check,
an issue view with an empty status,
decision answers keyed "0" and "1",
attempt counts keyed by index,
a found stream error with every field unnamed,
or a body that reached a later,
less precise refusal than its own.
Three modules refused arrays on their own beside the guard:
`artifact-guard.ts`'s `requireRecord`,
whose TSDoc gave as its reason that nineteen other modules used the guard
"for values where an array is legitimate",
which the census did not bear out;
`corpus-run/pass-schema-census.ts`;
and `artifact-exact-guard.ts`,
by testing for an array first.

The guard now refuses arrays,
and the three local refusals defer to it.
The red commit's fourteen cases,
one per kind of reader,
pass;
one of them never ran red,
since its file stopped at the first failing suite
(the multi-suite defect this audit fixes separately).
A fifteenth case,
for `isLookupRecord` (`lookup-cache.ts`),
built an array carrying the record's fields with `Object.assign`;
it was dropped,
since `isLookupRecord` now calls the guard,
whose own case covers it,
and no file read through `JSON.parse` yields such a value.

A second lapse sat beside the first.
Eighteen checks in thirteen files wrote the guard's old test inline
(`typeof value === 'object'` and `value !== null`)
rather than calling it,
so the fix to the guard reached none of them,
and the census of the guard's calls,
which searched by its name,
listed none.
Each now calls `isJsonRecord`,
among them `isLookupRecord` and `isLookupHit`,
the run lock's holder reader,
the slice cache's namespace reader,
the roster card's row check
(which already refused arrays),
and the three front matter readers in `corpus-run/directory-id-name.ts`,
which now read fields off the narrowed record without casts.
The first census of those inline checks searched only the `===` form,
and an edit anchored on one check matched two in `lookup-cache.ts`
before the `!==` form was searched.
One reader changes what it does:
the work-title search read an answer that is not an object as no results,
and now refuses it,
as the cited-reference fetch refuses one;
its refusal case gains that answer.
The attribution reader's part was superseded by B106:
an issue record whose `issue` is not a record,
read here as a view contributing nothing,
is now refused,
naming its path.

Reach:
not measured over stored replies or cache files.
The readers face provider streams,
the package's own cache and record files,
which it writes as objects,
and front matter;
an array reaches them only from a provider answering out of contract
or a file written by something else.
No cache version moves:
the change refuses only records whose named fields are arrays,
which the package's writers never produce.

What enforces it:
`src/record-checks.unit.test.ts`,
among the source scans,
fails on any `typeof` compared with `object` in the package's source outside `isJsonRecord`
and the seven checks it names with why
(a caught error read for its code,
stderr or position,
a member a type says cannot exist,
a spend reading whose other members are text,
and the shape a message names),
and fails when a named check no longer stands.
Its fixture case runs first;
with one converted check in `index-pair-list.ts` written inline again,
its package case failed,
and passed once the check was restored.

Calls made here are open to veto:

- the guard itself refuses arrays,
  rather than a second predicate beside it;
- a work-title search answer that is not an object is refused,
  rather than read as no results;
- the seven exemptions;
- the `Object.assign` case dropped for the guard's own.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B93: delta frames the Anthropic scanner could not read, passed over uncounted

Found in T8's twenty-second batch,
writing a case for the stretch census-lxT62v lists cold at `anthropic-delta-scan.ts:406`
(a `content_block_delta` frame with no delta returned nothing),
red in `ac4980b81`,
`840a41698` and `5a28319ed`,
fixed in the commit adding this entry.
The `DeltaScanner` contract in `stream-delta-scan.ts` describes `unreadableFrames` as payload lines that could not be read,
which should stay at zero.
The Anthropic scanner counted only a payload that did not parse
or parsed to something other than an object.
A delta frame with no delta object returned nothing,
and a delta of a type the scanner reads whose text field was absent or not a string
was read through `stringField` as empty and dropped,
so the tally stayed at zero for frames the completion reader refuses (B89).
`stream-drain.ts` writes that tally into the progress line it logs when a stream completes,
and calls no completion reader
(a search of it for the reader names exits 1);
`hyper-client.ts` reads the body with `extractAnthropicCompletion` after the retry ladder returns,
so a body the reader then refused was logged with no unreadable frame.
Now `readDelta` counts both,
reading the routed field's raw value with a type check
in place of `stringField`,
which cannot tell an absent field from an empty one.
The count follows what the scanner reads,
not what the reader refuses:
a `thinking_delta` with no `thinking` string is counted,
since the scanner files that channel,
although the reader passes thinking over.
A block start is read for its declaration alone,
so one naming no index,
carrying no block,
or whose block names no type string
yielded nothing it was read for and is counted too;
the reader folding no block start has no bearing on this tally.
The same red cases found that such a start at an index already declared
kept the earlier declaration when it carried no block,
and forgot it when its type was not a string:
the later block's deltas were read under the block before it in the first case.
A start at an index now supersedes the declaration there whether or not it can be read,
as a readable restart already did
(the 2026-08-25 capture noted at `ANSWER_DELTAS`).
An empty fragment is read,
not unreadable,
a delta frame naming no index is read by its own type,
and a type the scanner does not read is passed over whatever it holds,
as the streaming documentation asks of types added later.

Recurrence:
each reader of a wire counts or refuses a frame it reads and cannot,
judged by what it reads that frame for;
`mistake-prevention.md`,
"Provider fields read by their documentation".

### B94: Anthropic usage reported a zero for a count the stream never sent

Found in T8's twenty-second batch,
reviewing the lenient-arm case committed in `08635488c`,
which expected `prompt_tokens` 0 from a body that reported only `output_tokens`;
red in `4e82b6d7a`,
fixed in the commit adding this entry.
`usageOf` reported usage once any count series held a report,
and `latestOf` read a series never reported as 0,
so a stream that sent its completion count alone
came back with a prompt count of 0 that nobody measured,
and one that sent its prompt count alone
came back with a completion count of 0.
The same file's case for a stream reporting no count at all
says why that matters:
a reader must tell a call that cost nothing from one whose cost went unreported.
`readUsage` in `completion-shape.ts`,
the OpenAI-compatible reader,
reports usage only when both counts are numbers.
Now `usageOf` reports usage only when the stream reported both its `input_tokens` and its `output_tokens`,
and logs which one was missing when it reported one alone;
a cache series still reads as 0 when absent,
since a stream reporting no cache field used no cache this reader can count.

Reach:
`spend-line.ts` prints `prompt=` and `completion=` as unreported when usage is absent,
so a stream reporting one count alone now prints both as unreported
where it printed the one count and a 0.
The two captured streams the unit suite reads
(Charm Hyper on 2026-08-24,
OpenRouter's Messages endpoint on 2026-09-03)
report both counts,
and their cases pass unchanged.

Calls made here are open to veto:

- a count reported alone is dropped with its missing partner,
  as the OpenAI-compatible reader drops it,
  rather than kept beside an unreported partner:
  `CompletionUsage` in `module-llm-type` requires both counts.

Recurrence:
a count the provider never sent is absent,
never 0;
`mistake-prevention.md`,
"Provider fields read by their documentation".

### B95: text ordered by the runtime's locale

Found 2026-10-01 (UTC) by a census of the package's orderings
(`~/temp/agent/audit-glossary-fix/locale-order-census-report.md`),
red in `169218442`,
fixed in the commit adding this entry.
`orderBySourceSize` in `corpus-run/bench-draw.ts` broke a source-size tie with `localeCompare` on entry ids,
which are the corpus's own directory names,
so the order of tied slices,
and with it which slices `pickSpreadSample` drew for a benchmark,
followed the locale and collation data of the machine that ran it:
a collation interleaves capitals with lower case,
and code points put every capital first.
Nine more `localeCompare` calls ordered candidate ids,
claim and cluster ids,
coverage sources and bundle names,
and sentinel rows;
the census measured each on its value domain and found every tested locale agreeing with code-point order,
so none moved an output today,
but each rested on its domain staying closed.
Three tests ordered with it too,
one of them under a description saying it ordered by code unit.
`preservation-check.ts` sorted lost document words with the default order,
which compares UTF-16 units and puts a character past U+FFFF before one between U+E000 and U+FFFF.
`compareCodePoints` (`code-points.ts`) now orders text by code point,
the same on every machine,
and every one of those sites uses it.
`locale-orderings.unit.test.ts`,
a source scan,
finds `localeCompare`,
the `toLocale` casing and formatting members
and `Intl.Collator` in source and tests;
it found none outside its fixture once the sites moved.
`memberName`,
the scan's reader of a member's name,
moved from `wall-clock-reads.unit.test.ts` to `source-scan.test-fixture.ts`
so the two scans share it.

Reach:
a benchmark drawn before this fix and after it can differ wherever a source-size tie was broken by entry id.
The other orders the census measured do not move.
Sorts of entry ids with the default order
(`corpus-pass.ts` and `pass-decline.ts`,
both for log lines)
and comparators using `<` on ids are left as they are:
they are the same on every machine,
and differ from code-point order only for a character past U+FFFF in an id.

Calls made here are open to veto:

- code-point order for every text the package orders,
  in place of keeping `localeCompare` where its domain measured stable;
- the default order kept for entry ids sorted only for log lines.

Recurrence:
text is ordered by `compareCodePoints` and cased without the locale;
`mistake-prevention.md`,
"Text by code point";
the scan refuses a new locale-dependent call.

### B96: TSDoc blocks that document nothing

Found 2026-10-01 (UTC) by a census of every TSDoc block in the package
(`~/temp/agent/audit-glossary-fix/orphan-tsdoc-census-report.md`,
29,778 blocks read forward from each block to what follows it),
fixed in the commit adding this entry.
A TSDoc block documents the declaration directly after it.
30 stood where no declaration claimed them:
before a second TSDoc block,
before a `//` comment,
or before a statement,
so a reader at the declaration saw the other block or none,
and the tsdoc lint plugin never read them,
since every one of its rules walks from a declaration back to the nearest block
(`createTsdocVisitor`,
`package/oxlint-plugin/tsdoc/src/rule/tsdoc-visitors.ts`).
Twelve moved to the declaration they describe,
three of them merged with a shorter block already there;
eight that described statements became `//` comments;
five that repeated the declaration's own block went,
two after folding in a clause the survivor lacked;
and five pairs of a TSDoc block and a `//` comment became one block.
Seven file headers gained the `@module` tag the package's other headers carry.

37 more blocks were separated from their declaration by a `disable-next-line` lint suppression,
the shape the repository's rule forbids
(a suppression on a documented declaration opens before the TSDoc and closes after the declaration).
They were rewrapped in a change of their own,
which converted the one `eslint-disable-next-line` among them to the `oxlint` form
and merged two neighbouring suppressions in `cased-letters.ts` into one pair;
in each of the 27 files every rule a block disables is enabled again
(a count of the disable and enable comments per rule,
2026-10-01 UTC),
and the lint reported 0 warnings and 0 errors after it.

What enforces it:
`src/tsdoc-attachment.unit.test.ts`,
among the source scans,
reads forward from every TSDoc block and fails on one followed by anything but what it documents:
a declaration,
a class or object member,
an enum or union member,
or a function expression returned or passed;
a block holding `@module` is exempt.
Its fixture case finds five orphan shapes and none of the legitimate ones;
with one `disable-next-line` suppression put back between a TSDoc and its declaration in `renders-as-nothing.ts`,
its package case failed,
and passed once the line was removed.

Recurrence:
`mistake-prevention.md`,
"Lint and edits".
