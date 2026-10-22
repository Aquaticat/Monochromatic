# Audit ledger: provider streams, usage counts and retries

Provider fields read otherwise than the provider documents them:
stream events,
usage counts,
and the refusals a retry decision reads.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B87: an Anthropic stream's ending read off a word, and its error event read as a cut stream

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

## B88: prompt tokens that left out the cache

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

## B89: Anthropic answer fragments dropped without a word

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

## B91: a delta type the Anthropic scanner does not read, claimed as reasoning in a thinking block

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

## B93: delta frames the Anthropic scanner could not read, passed over uncounted

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

## B94: Anthropic usage reported a zero for a count the stream never sent

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

## B124: a refuser held out for no time ended the call as every provider dry

Red in `804ae3e85`.
Found reading `budget-hold-wait.ts` for the T8 bundle 2 review.
`markRefused` (`provider-budget.ts`) holds a refuser whose meter reads wet for the rate-limit backoff
only when another provider reads wet,
so the calls move there;
with every other provider dry it holds it for no time,
and the transport ladder paces the retries
(XIEPT2,
2026-09-03).
The router then asked again with that refusal folded in,
and `readBudgetsPastHolds` read every provider dry,
found every hold at 0 ms,
and raised `EveryProviderDryError`,
whose message says Synthetic has no five-hour or weekly credit left,
while its meter read wet.
The two rules were each right alone:
the budget layer meant the refuser to stay spendable at once,
which its own case asserts ("HOLDS NOTHING when a wet provider refuses us"),
and the hold wait meant a just-refused provider to read dry.

Measured:
a probe on the built package
(the real `createProviderBudgets` and `createRoutingClient`,
stub meters with Synthetic wet and the others empty,
a Synthetic caller refusing one call with a 429)
asked Synthetic once and threw,
holds all 0 ms,
for a four-provider seat and a Synthetic-only one
(`t8-par/b124/wet-refuser.mjs` in the audit scratch).
Among the 8,511 `.log` files under the agent scratch
(walked three levels deep,
as the P1 measure walked),
166 all-dry errors name a refuser "just refused this call" with every hold at 0 ms,
all in the Uekawakuyuurei pictures log of 2026-09-04,
beside 166 zero-hold refusal lines there;
each was logged "voice lost",
so the seat's voice was lost each time,
not the run
(`stage-call.ts` catches the error per seat).
The huasheng4 log's 34 all-dry errors all waited out a hold first,
so they are not this.

The fix:
`readBudgetsPastHolds` returns the first reading,
the refuser wet in it,
when the provider that just refused reads wet by meter and has no hold left,
and logs that it asks that provider again.
A unit case pins that reading,
and a router case drives the real budget layer:
Synthetic refuses once,
is asked again,
and answers.
The probe on the fixed build asks Synthetic twice and is answered both times.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

## B202: a request the provider refused in a stream's error event was retried

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as the item ledger B87 left open.
An Anthropic stream's error event naming a type the provider documents for a refused request
was refused as a `MalformedCompletionError` and retried on the ladder,
spending every attempt on a request the provider refuses again,
where the same refusal over plain HTTP is returned unretried,
400 being no retryable status.
A scripted 200 stream carrying an `invalid_request_error` event drew 3 transport calls where 1 was expected.

The fix:
`requireWholeAnthropicMessage` (`anthropic-whole-message.ts`) throws `StreamErrorEventError`,
a marked `SyntheticHttpError` (renamed `ProviderHttpError` on 2026-10-19)
that carries the status the refusal has over plain HTTP and names the type alone,
with nothing of the provider's body;
`attemptExchange` (`transient-retry.ts`) rethrows a thrown `SyntheticHttpError`
(renamed `ProviderHttpError` on 2026-10-19) whose status is not retryable.
The types read as refused,
by the provider's errors page as the fixing agent read it:
`invalid_request_error` (400),
`authentication_error` (401),
`billing_error` (402),
`permission_error` (403),
`not_found_error` (404)
and `request_too_large` (413).
A `billing_error` so carries 402,
which the provider-budget branches read as they read the plain one.
Retried as before:
`rate_limit_error`,
`api_error`,
`timeout_error`,
`overloaded_error`,
a type the package does not know
and an event that names none.
The class joined the inventory of marked classes,
its `errorType` a named part from a closed list this package holds.

Not read by the agent:
the provider's page on streaming,
whose section on error events it could not open in its session;
the frame's shape rests on the errors page,
on ledger B87 and on the cases the file already held.

Open to the owner's veto:
`conflict_error` (409) stays retried,
since its documentation says to resolve the conflict and then retry.

Open when this entry was written,
closed in B251 (`df807a8b5`):
`InStreamProviderError` (`openrouter-stream-error.ts`) carrying a 4xx code still rides the ladder,
and the Bedrock reader names no error event in its stream end.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
a refusal means the same on the ladder whichever channel it arrived by.

## B251: a 200 stream whose error chunk carried a 4xx code drew the whole retry ladder

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
closing the item B202 left open.
A 200 stream whose OpenRouter error chunk carried a 400 or a 402 drew 3 exchanges for one request,
where the same refusal over plain HTTP is returned unretried (the agent's probe on a ladder of two retries).

The fix:
`InStreamRefusalError`,
a marked status failure carrying the code as its status,
is thrown by `requireNoStreamError` for a whole-number 4xx code other than 408 and 429,
and the retry ladder returns it unretried;
every other code still throws `InStreamProviderError`.
`requireBedrockStreamEnd` reads an error chunk before it asks for its terminator,
so an error chunk is named by its cause and not as a stream cut off before its end.
The cases are "SPENDS ONE EXCHANGE on a 200 stream whose error chunk carries a 4xx code,
since the same refusal over plain HTTP is returned unretried,
and a 429 chunk rides the whole ladder" (`openrouter-client.unit.test.ts`),
and "NAMES AN ERROR CHUNK on either route by its cause,
a refusal for a 4xx code and a provider failure for any other,
where both read as a stream cut off before its end" (`bedrock-stream-end.unit.test.ts`).
The lead added the `@throws` lines of the two clients' whole-message checks.

Not read from a captured frame:
the Bedrock reading is the OpenAI-compatible convention.
AWS documents no error frame in a stream,
by the agent's reading of its pages on 2026-10-06,
so a real Bedrock error frame may look different.

Open to the owner's veto:
a 409 chunk is now unretried.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

## B718: a reply the length limit cut before any answer ended that reader's turn on the picture

Red `5dee1b41f9`,
fixed in `8423f77dc2`.

Found on 2026-10-21 (UTC) in the read of the corpus pass for `XingZ6016`,
and fixed in `w258`.

What the run showed:
the pass stopped incomplete because the entry's one picture had a single reading.
`glm-5.3-flash` on NeuralWatt answered `text:""` with `finishReason:"length"`,
having spent its whole completion cap (18316 tokens) reasoning at NeuralWatt's default effort `max`,
for 8188 prompt tokens.
The reader stage recorded `empty-reply` and went on,
and the second reader alone could not corroborate.

The rule the code broke:
`readPastRefusal` re-asked a refusal up to `REFUSAL_ASK_LIMIT` times and treated every empty reply as final.
An empty reply that ended on `stop` is a fact about the picture or the model.
An empty reply that ended on `length` is a fact about one call's budget,
and says nothing about whether the model can read the picture.

The fix:
`readImageAsset` marks an `empty-reply` whose finish reason was `length` with `cutByLength` and the provider that served it (`servedBy`).
`readPastRefusal` then asks once more.
It sends the ask with `otherThan` set to the provider that cut the reply,
so the router serves another wet provider that carries the same model.
Where the router has none (`NoProviderForModelError`) the ask goes again to the same provider.
Every other failure keeps its own handling.
The line names the picture,
the finish reason,
the provider and the route the second ask takes.
The second ask carries the next entry of `IMAGE_READING_PERSPECTIVES`.
The payload store keys a reply on the model and the message bytes,
so an ask with identical bytes would have replayed the stored empty reply.
A second empty reply stays `empty-reply`,
and an empty reply that ended on `stop` is asked once as before.

Cache versions:
the re-ask changes only the transient `unavailable` verdicts,
which are never resumed (`isResumableReading`),
and readings it produces enter the cache under the same key as any reading.
No key moves.
The audit (`cache-account-audit`) lists the commits among the source commits no account names,
which is the standing state of the package.

Not checked:
whether a second ask recovers on `glm-5.3-flash`.
No provider was called in writing this fix.

Open to the owner's veto:
one re-ask,
not more,
and the next perspective as the changed text.

Recurrence:
`design-commitments.md`,
"A reply the length limit cut is re-asked as cut,
not as off the shape" (ledger P10):
the picture readers now follow the same rule the stages' recovery round already holds.

## B719: a NeuralWatt picture call ran at the provider's default reasoning effort

Red `ae7ba82828`,
fixed in `127a8f6eb2`.
It revises P11 for NeuralWatt only.

Found on 2026-10-21 (UTC) in the same read as B718,
and fixed in `w258`.

What the run showed:
`glm-5.3-flash` is a reasoning-only model on NeuralWatt,
and the body carried no effort,
so the provider applied its default `max`.
That is the cause of the 18316-token reasoning run in B718.

What the documents say
(fetched 2026-10-21 from `docs.neuralwatt.com/api/chat-completions.md`,
`api/models.md` and `GET /v1/models`):
the model's reasoning is mandatory,
`supported_efforts` are `max`,
`high` and `low`,
`default_effort` is `max`,
and `reasoning_effort` is a documented string parameter.
`thinking_token_budget` is documented too,
but its support table (2026-08-26) does not name this model,
so it is not used.
NeuralWatt documents no image token accounting.

The owner's ruling of 2026-10-21 lifts the ban on passing parameters for NeuralWatt only
(two sentences of one message,
the dash between them left out here):
"NeuralWatt is a special case of all the providers:
It implements what it documents correctly,
almost always"
and
"I'm lifting the ban on passing params,
but only for NeuralWatt."
The standing rule of 2026-08-25 holds for every other provider and for NeuralWatt text calls.

The fix:
the type that makes a card a NeuralWatt card carries `pictureReasoningEffort` (`low`,
`high` or `max`),
and the GLM seat's NeuralWatt side names `low`.
The NeuralWatt client sends `reasoning_effort` only on a call that carries a picture,
read off the NeuralWatt card side.
No other provider's card type has the field,
so no other client can send it.
`neuralwatt-picture-effort.unit.test.ts` pins the value on the picture call,
none on a text call to the same seat,
none on a picture call to a seat whose card names none,
and that the only card sides naming an effort are NeuralWatt's.
`owner-body-rules.unit.test.ts` now sends a picture through the Synthetic,
Hyper,
OpenRouter and Bedrock clients and expects no forbidden key in any body.

Cache versions:
a reading made at `low` differs from a reading made at `max`,
but a stored reading is not asked again,
and the key names the bytes,
roster,
instruction,
perspectives and threshold,
none of which moves.
New readings are produced under the new effort.
No key moves.

Not measured:
neither `low` nor `max` has a measured picture-reading quality on this seat.
The first keyed run at `low` is the measurement.

Open to the owner's veto:
`low`,
not `high`.

Widened on 2026-10-21 (UTC) by B807:
the lift covers the NeuralWatt text calls of the same seat too,
and the standing rule of 2026-08-25 now holds for every other provider only,
where this entry's ruling paragraph said "and for NeuralWatt text calls".

## B720: the NeuralWatt energy estimate counted a picture as base64 text

Red `7dfd70e7d5`,
fixed in `5d6c111206`.

Found on 2026-10-21 (UTC) in the same read as B718,
and fixed in `w258`.

What the run showed:
a 1271156-byte picture (2400 by 2616) made a 1.7 million byte body,
which the estimate read as 423985 prompt tokens and held at the top bucket,
0.9089 Wh for `glm-5.3-flash`.
The provider reported 8188 prompt tokens,
and the call measured 0.2311 Wh.
Two 576 by 1280 pictures read for 1156 reported prompt tokens each against 26957 and 32466 estimated.

The fix:
`promptTokensOfRequest` takes each inline picture out of the text bytes and counts it by its patches,
round(width / 28) times round(height / 28),
read off the file header
(`imagePixelSizeOf`:
WebP lossy,
lossless and extended,
PNG and JPEG).
2400 by 2616 is 86 by 93,
7998 tokens,
and 7998 plus 190 tokens of text and framing is the reported 8188.
576 by 1280 is 21 by 46,
966,
and 966 plus 190 is the reported 1156.
A picture whose size cannot be read,
or that is not inline,
is held at 8192 tokens,
a little above the largest count reported.
The bucket,
the margin (`NEURALWATT_ENERGY_MARGIN`,
one) and the settlement that replaces the estimate with the measured energy are untouched.

Limits:
the 28 pixel grid and the 190 are a fit to two pictures,
the second the check of the first,
and a guess for other sizes and for the DeepSeek seat,
which has never read a picture here.
NeuralWatt documents no image accounting.
The estimate only sizes the hold a call has in flight.

Cache versions:
the estimate feeds the in-flight hold and the ledger line only.
No cached stage result reads it.
No key moves.

Not done:
`openrouter-abandoned-spend.ts` estimates an OpenRouter body by the same bytes over four,
and a picture there has the same overcount.
The owner's ruling named NeuralWatt.

## B804: the stream guards could not fire, and a comment line counted as progress

Status:
fixed on 2026-10-21 (UTC),
red `65b3695fc7b0816f4e3af187ae4c3a27560474cd`,
fix `2866c62ebd7a361d94854fe1c43a1f70288eef7e`,
first-content window revised from 120000 ms to 180000 ms before landing,
with `firstContentMs` logged,
in `e2c0cbbf90534ec838712d76e1f8e77dfa7d12ed` (see "The choice"),
cache versions none.
Found in the read of the corpus pass for `zheermao22` (class K2) and fixed in `w263`.

What the run showed:
eleven `inception/mercury-2.5` streams were ended 120 s after quorum by the straggler grace,
each with 0 answer characters and 0 reasoning characters on 7575 to 13000 raw characters
(21:59:56 UTC to 22:23:44 UTC).
All eleven raw counts are multiples of 25,
the length of the comment line `: OPENROUTER PROCESSING` and its two line feeds.
The log holds counts and not bytes,
so that the bytes were those comments is an inference from eleven of eleven.
Mercury's consolidation stream time was 1701 s against 462 s in `zheermao21`.

What the code did:
two defects,
one hiding the other.
`STREAM_FIRST_BYTE_MS` and `STREAM_IDLE_MS` were 600000 ms beside a per-call deadline of 360000 ms,
so neither window could fire before the deadline did,
and the artifact stamped `perCallTimeoutMs: 360000, streamFirstByteMs: 600000, streamIdleMs: 600000`
without anything reading the pair.
And `drainBody` told the guard about every chunk,
so any body bytes reset the window,
a comment line among them.
Had the windows been shorter,
Mercury's comment lines would still have kept them open.
The straggler grace (`stage-round.ts`) was the only bound that ever ended these calls,
and it ends them only after a quorum.

What was measured,
keyless,
from the progress lines of the pass logs in the agent directory,
`CuspariaKLSY20` to `zheermao22`
(`~/temp/agent/tr-fan/w263-scratch/stream-stats.ts`,
`stream-tails.ts`,
`stream-long.ts`,
`stream-empty.ts` and `stream-cutmercury.ts`,
outside the repository;
the live log `XingZ6017` left out):

- 19542 completed streams carried text.
  Their first byte,
  leaving out OpenRouter streams whose first byte may be a comment line:
  p50 1915 ms,
  p99 11755 ms,
  p99.9 88110 ms,
  largest 115725 ms.
  Their largest silence between two chunks:
  p99.9 59008 ms,
  largest 93736 ms.
- The streams a bound cut after they had delivered text show a first byte of at most 48854 ms and a gap of at most
  61642 ms,
  so the sample is censored from above by the 120 s grace and the 360 s deadline,
  and the censored part does not hide a slower healthy start.
- The logs record the time to first byte and not the time to first text.
  The first byte is a lower bound on the second,
  so the largest first byte (115725 ms) is not a ceiling on the wait for text.
  A stream whose first byte came early and whose first text came late waited longer than the log shows,
  and no log read for this entry can say by how much.

The choice:
180000 ms for the first-content window and 120000 ms for the idle window,
and the basis is the largest observation and not a percentile.
A bound at p99.9 would cut about 20 healthy streams of the 19542,
and each cut costs a paid call and a retry,
so each bound sits above everything seen.
The idle window is 28 percent above the largest gap (93736 ms),
a quantity the logs measure directly.
The first-content window began at 120000 ms,
3.7 percent above the largest first byte (115725 ms).
That margin is over a lower bound on the quantity the window bounds,
so the true margin could have been negative and a healthy slow stream cut.
It is 180000 ms now,
which is 56 percent above the largest first byte.
Both windows are below the 360 s deadline,
so a stalled call ends in half its deadline at most,
and Mercury's silent streams end at 120 s after their last text or at 180 s after arming,
without waiting for a quorum.

Older tail evidence now cut:
a `hf:zai-org/GLM-5.2` first byte of 183755 ms,
a pass-7 completion at 347099 ms and a mid-stream gap of 124992 ms
(`doc/audit/stream-guards-first-production-traffic.md`,
`doc/handover/translation-repair-history.md`)
are longer than the new windows.
The first of them is only 3755 ms over the first-content window,
so the widening does not clear it,
and it is not meant to.
They came from rosters that are gone,
and the 347099 ms completion sits within 4 percent of the old deadline of 360000 ms,
which the bound must remain shorter than.
They are retired as evidence,
not contradicted.

The fix:
`drainBody` hands the guard the running totals of content and reasoning characters
(`generatedChars()` of the stream scanner),
and the guard resets its window only when the total grows.
The raw characters still count for the progress line.
The phase names are `first-content` and `body`.
`requireStreamBoundsInsideCallTimeout` (`stream-bound-config.ts`) refuses,
by `StreamBoundsOutsideCallTimeoutError`,
a bound that is equal to or longer than the deadline,
or that is not a positive finite number,
and so does a deadline that is not.
`runCallConfigOf` in `run-config.ts` calls it,
and `RUN_CALL_CONFIG` is built through it at module load,
so a run with an inconsistent configuration ends before it spends anything.
The key `streamFirstByteMs` of the stamped configuration is now `streamFirstContentMs`.
Older artifacts keep the old key.
The retry ladder (`exchangeWithRetry`) names the provider on the exchange it hands the transport,
and the guard's cut line reads
`<provider> <model>: no content or reasoning for <N>ms during <phase>; <N> raw chars on the wire, <N> content chars and <N> reasoning chars so far; aborting for retry`.

Red and green:
`stream-content-progress.unit.test.ts` cuts a stream of comment lines only,
one of blank lines only,
one of role-only and empty-content events,
and one that falls to comment lines after its first words,
and keeps a stream that sends a content delta or a reasoning delta every 8 ms.
It failed with five assertion failures and its two controls passed.
`stream-bound-config.unit.test.ts` refuses the pair that shipped,
a bound equal to the deadline,
and each of not-a-number,
zero,
a negative and infinity,
and pins the shipped windows above the largest healthy observations,
the first-content window half again over the largest first byte,
and both below the deadline.
`stream-idle-guard.unit.test.ts` pins 180000 ms and that the 183755 ms first byte is still cut,
and times the first text beside the first byte;
`stream-cut.unit.test.ts` reads `firstContent` off the progress line,
and `stream-content-progress.unit.test.ts` reads a negative `firstContentMs` off a stream of comment lines that did send bytes.
`run-call-config-builder.unit.test.ts` hands `runCallConfigOf` the shipped pair.
`provider-named-exchange.unit.test.ts` reads the provider off the exchange of each of the five clients.
Each failed before the fix,
at import or on an assertion,
and passes after it.

Cache versions:
none moves.
The windows and the call configuration are in no cache key,
as `perCallTimeoutMs` is not:
they change how long a voice has to answer,
not what it is asked.

The time to first text:
the progress line of every stream,
completed or cut,
now carries `firstContent <N>ms` beside `firstByte <N>ms`
(`StreamProgress.firstContentMs`,
negative when no content or reasoning delta ever arrived).
The first-content window was set against the first byte because the logs held nothing else;
the next reading of the pass logs sets it on the quantity it bounds.
Logs written before this change carry the first byte alone.
The change is diagnostic only:
no window,
cache key or decision reads the new field.
The straggler grace stays as a second bound after quorum.

Limits:
the first-content window is 56 percent over a lower bound.
A model that thinks for longer than 180 s before its first delta,
with its thinking hidden from the stream,
would be cut where it was not,
and the first text of such a stream is the figure the new field records.
The logs read hold no such stream among the completed ones,
but they do not record whether a model hid its thinking,
so this is unmeasured.

Open to the owner's veto:
180000 ms for the first-content window,
which the parent chose over 120000 ms because the margin over a lower bound could be negative.
Changing it is `STREAM_FIRST_CONTENT_MS`.

Recurrence:
`mistake-prevention-guards-searches-and-claims.md`,
"A bound is read against the deadline it sits under":
a bound is checked,
at the place both numbers are read,
against the deadline that would pre-empt it,
and progress means the output the bound is for.

## B807: a NeuralWatt text call ran at the provider's default reasoning effort

Status:
fixed on 2026-10-21 (UTC),
red `b5fd3e9a3bd0ff7794ede7b1475b33167b69e891`,
fix `109f1b7a7eb927191776a92de8d3df151483ce1c`,
cache versions none.
Found in the read of the corpus pass for `zheermao22` (class K1) and fixed in `w263`.
It widens B719,
which built the owner's lift for pictures only.

What the run showed:
four `glm-5.3-flash` calls on NeuralWatt ran to the 18316-token cap with 0 content characters
(`zheermao22` log lines 514,
533,
1983 and 2209,
at 21:17:32 UTC,
21:20:36 UTC,
21:37:15 and 21:40:06 UTC),
12.0174 Wh,
29 percent of the run's NeuralWatt energy.
The Hyper re-ask of each ran to its own cap three times of four,
and two recovery rounds waited the full writer grace (180 s and 175 s) and heard nothing.
The same call on the letter block capped in `zheermao20` and `zheermao21`,
so it is the third run in a row.

What the code did:
`neuralwatt-client.ts` took the card's `pictureReasoningEffort` only when the request carried a picture,
and sent `reasoning_effort` only then.
B719 had read the owner's two sentences of 2026-10-21
("NeuralWatt is a special case of all the providers:
It implements what it documents correctly,
almost always"
and
"I'm lifting the ban on passing params,
but only for NeuralWatt")
as covering the call kind that had failed that day.
The words name the provider,
not the kind of call.

What was measured,
keyless,
from the `SPEND provider=neuralwatt` lines of every pass log in the agent directory except `XingZ6017`,
which was still being written when this was counted
(`~/temp/agent/tr-fan/w263-scratch/nw-spend2.ts`,
outside the repository;
a picture read is left out by its `read photo` line right after the spend line;
the cap of each model is `model-cards.ts`):

- `glm-5.3-flash`,
  288 text calls at the default effort `max`.
  Cap 18316.
  Capped:
  11 (3.8 percent),
  7 of them on prompts of 11509 to 13908 tokens (the size of the letter block's review,
  which the reads of `zheermao20` to `zheermao22` name) and 4 on prompts of 7064 to 9451 tokens,
  and none a picture (the capped call of `XingZ6016` is the picture of B718,
  8188 prompt tokens,
  not counted).
  Uncapped,
  277 calls:
  p50 2125,
  p75 3950,
  p90 7573,
  p95 10778,
  p99 15731,
  largest 18262.
  Of the uncapped,
  9 passed 12000,
  5 passed 14000 and 2 passed 16000.
  Of the 31 calls past 9158 (half the cap),
  11 capped.
- `deepseek-v4.1-flash`,
  819 text calls at its default effort `high`.
  Cap 13082.
  Capped:
  12 (1.5 percent).
  Uncapped,
  807 calls:
  p50 802,
  p90 2840,
  p99 9121,
  largest 11591.

The choice:
`low` on the GLM seat's text calls.
The brief's test is whether the uncapped calls sit well under the cap or crowd it.
The bulk sits well under (p90 at 41 percent),
but the tail does not:
p99 is at 86 percent of the cap,
the largest uncapped call is 54 tokens short of it,
and a call that reaches half the cap capped in 11 of 31 cases.
`high` is the other candidate.
DeepSeek runs at `high` by default and capped on 1.5 percent of its calls,
so `high` is not shown to cure the runaway.
No measurement exists at `high` or at `low` for text on this seat;
the first keyed run at `low` is the measurement,
and a shallower effort may cost editing quality that the cap-outs never showed.

DeepSeek V4.1 Flash:
no effort is sent.
The repo records its default (`high`,
`neuralwatt-catalog.ts`) and that reasoning is on by default
(`doc/decision/translation-repair-neuralwatt-provider.md`),
and records no `supported_efforts` list for it.
B719 lists the supported efforts for GLM-5.3-Flash alone.
Nothing the repo holds documents a value to send.

The fix:
`NeuralWattCard` carries `textReasoningEffort` beside `pictureReasoningEffort`,
the catalog row copies it,
and the client sends the picture effort for a request that carries a picture and the text effort otherwise.
Only the GLM seat's NeuralWatt side names one.
No other provider's card type has the field.
`neuralwatt-text-effort.unit.test.ts` pins `low` on a plain and on a schema call to the GLM seat,
none on the DeepSeek seat,
and that the only card sides naming a text effort are NeuralWatt's GLM side,
at a level the listing documents.
`neuralwatt-client.unit.test.ts` pins the body of both seats,
and `owner-body-rules.unit.test.ts` still expects no forbidden key in the body of any other provider.
The red cases failed with `expected undefined to equal 'low'` and an empty list of naming card sides.

The retry at `low` before the next-seat re-ask was checked and not built:
B718 re-asks a picture reading once with the next perspective,
which changes the message bytes.
A text call has no such text to change.
The payload store keys a reply on the model and the message bytes alone
(`prompt-uniqueness-client.ts`),
so a second ask of the same bytes returns the stored empty reply,
and the nudged re-ask goes to another provider on purpose
(`nudged-reask.ts`:
"the same bytes asked again would be the same sample").
With `low` sent from the first ask,
a retry at `low` would repeat the first ask.

Cache versions:
none moves.
No slice-cache key hashes a request parameter:
the keys hash the version,
the shape of the run and the texts,
and the reasoning for the call deadline (`perCallTimeoutMs`,
"changes how long a voice has to answer,
not what it is asked") holds for an effort.
The payload store sits under the run's own runs directory (`runs-layout.ts`,
`PROMPT_PAYLOADS_DIR`),
so a new run starts with none,
and a resume of a run begun before the change reads replies already paid for at the old effort,
which is wanted.
This is the reading B719 took for the picture effort ("No key moves").

Limits:
the energy matrix the meter estimates from was drawn at the default efforts,
so a call at `low` holds more than it uses;
the settlement replaces the hold with the measured energy.
The hold is larger than needed,
never smaller.

Open to the owner's veto:
`low`,
not `high`,
for text.
Changing it is the value in `neuralwatt-card-sides.ts`.

Recurrence:
`mistake-prevention-inputs-defaults-and-values-read-from-text.md`,
"Provider fields read by their documentation":
an owner's lift is built at the scope its words name.
