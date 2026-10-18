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
a marked `SyntheticHttpError` that carries the status the refusal has over plain HTTP and names the type alone,
with nothing of the provider's body;
`attemptExchange` (`transient-retry.ts`) rethrows a thrown `SyntheticHttpError` whose status is not retryable.
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
