# Audit ledger, part 42

Part 42 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B319: nothing stopped a built command from running in a shell that held provider keys

Red in `668340466`,
fixed in `3d36ba7b9`;
the configuration doc's paragraph broken at its semantic points in `c8196cf6c` (M133),
and the corpus pass runbook's two direct starts given the marker in `5f3e26958`.

Found on 2026-10-06 (UTC) after M120:
an agent started a built command by hand from a shell holding the operator's real keys,
and one start bought six model calls.
The rule for agents that followed is no guard.

The fix:
`taskRunnerVerdict` (`task-runner-guard.ts`) lets a process that holds a key,
a variable whose name ends `_API_KEY` with a value that is not blank,
run a command only when `TRANSLATION_REPAIR_STARTED_BY` names that command;
a process holding no key runs as before.
`reportingRefusals` takes the process's environment as a required `env`
and asks the guard before it reads the command line,
so the refusal is the stated one every entry ends in,
at exit 6.
Each of the 42 entry files hands it `process.env`,
and each of the 42 command tasks in `mise.toml` sets the marker to its command's name.
`runBuiltCommand` of `child-environment.test-fixture.ts` is the one way a test starts a built command,
and sets the marker for the command it starts unless a case asks otherwise;
four wrapper fixtures were folded into it,
by the agent's account 83 call sites in 26 test files.
`task-runner-guard-reach.unit.test.ts`,
among the source scans,
fails a task that starts a built command without the marker,
a built command no task starts,
and an entry that hands no environment;
on the red tree its package case reported 84 findings,
the count of the 42 tasks and the 42 entry files the fix changes.

The lead's change to the agent's wording,
open to the owner's veto:
the agent wrote the refusal as "unless its own task started it",
the task as the one way out;
the corpus pass runbook starts a built file directly where nothing may rebuild while a pass runs,
so the marker is the process's own statement of the command it means to start,
which the task,
the test fixture or an operator by hand sets,
and the refusal names both ways.
The module's comment says the guard is no access control.
Measured by the lead:
started through its task from a shell holding the session's keys,
`spend-report` built the package,
passed the guard and printed its own refusal for a missing log file at exit 6;
`mise tasks info` reads the marker on the task.
The whole suite on `3d36ba7b9`,
run in a side checkout:
1,993 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 44 source scans passing.

Open:
a process that imports the built library directly,
a `node --eval` or a script,
can still build a client from its environment,
since the library cannot know what started it;
a shell in a worktree still holds the keys.
Three test files start a built command through `runKeyless` with their own path
(`verify-published`,
`editor-standing-read`,
`sink-names-only`),
keyless,
so the guard passes them.

Open to the owner's veto,
the agent's:
a blank key value counts as no key;
a marker value is repeated in the refusal only when it has a command name's shape;
`env` required on `reportingRefusals`.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world" and "Guards that cannot fail".

### B320: an editor's edit nested past the bound ended the repair chunk after its checkers were paid

Red in `d0aebf8a7`,
fixed in `71702c550`.

Found on 2026-10-06 (UTC) by the agent following up B301,
over every place a voice's text reaches a parse no stage catches.
The editor's wire carries free text,
and the apply gate checked what an edit kept and quoted,
never whether a grammar reads what it leaves.
An edit of 300 nested list markers,
or of 300 open brackets,
passed the gate,
was judged and checked,
and was then parsed by `settleChunkFromChecks`,
which raised the plain grammar's `MarkdownParseError` out of `repairChunk`.
In a document of two slices,
both slices' repairs were lost,
and the chunk's checkers had been paid for nothing.
Quotation markers never reach the parse,
since `clampQuoteDepth` reduces them to one level.

The fix:
`applyPatchOperations` (`apply-patch.ts`) reads,
for each operation it accepts,
the text the accepted edits and the candidate leave
(`nestingWithEdit`,
`patch-nesting.ts`,
which runs `firstNestingExcess` under the plain grammar),
and rejects an operation past the bound as `unreadable-replacement` with the measure's reason,
through the gate's existing rejection path;
`editor-candidates.ts` records the reason against the voice.
The refine lane (`refine-stage-replies.ts`) names the same reason `refine-unreadable-rewrite` instead of throwing.
A case pins the boundary:
256 markers apply.
The lead moved the nesting exports out of `index.ts` into `nesting-barrel.ts`,
since the agent's lines would have taken `index.ts` past the 300 lines `eslint/max-lines` allows.
The whole suite on `71702c550`,
run in a side checkout:
2,010 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 44 source scans passing.

Open to the owner's veto,
the agent's:
the gate reads the whole spliced text for each operation,
quadratic in a slice's operations;
the bounds of 256 levels and 1,024 delimiters stay;
no parse in the gate for exhausting the stack below the bound,
since by the agent's measurement the parser needs 82 to 1,175 frames against 13,899 available;
the parses that read lane output after a floor stay throws.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a voice's text is refused as that voice's by its stage's own gate,
before judges and checkers.

### B321: the nesting scan skipped what a fence holds where the parser read no fence

Red in `d0aebf8a7`,
fixed in `71702c550`.

Found on 2026-10-06 (UTC) by the agent of B320.
The measure B301 added skipped every line after a fence line,
where the parser reads no fence for a backtick fence with a backtick in its info,
a fence indented four columns or a tab,
a fence in a quotation or list item the next line leaves,
or a fence line in raw html,
a math block or an indented code block.
Each passed texts the parser then nested:
by the agent's measurement,
to a tree depth of 303 for open tags and 3,003 for opened emphasis,
and in 700 to 2,200 ms for a link in a link 3,200 deep and emphasis 3,000 deep.

The fix:
the scan skips a fenced stretch only where the parser certainly reads a fence
(`certainFenceOf`,
`nesting-fence.ts`):
the line begins with the fence outside every container,
a backtick fence has no backtick in its info,
no raw html block is open (`nesting-html-block.ts`),
and under the strict grammar no math block has been seen and no brace or tag is open.
A fence line the scan cannot be certain of opens a loose fence whose lines are counted until a closing line.
`nesting-fence-differential.unit.test.ts` reads a generated family of texts against the grammar's own parser.
The agent's version pinned how many texts the scan passes (60,
36 and 36);
the lead's asserts that the passed texts are exactly those its stated rule skips,
and its oracle rethrows any failure of the plain grammar's parser.
By the agent's measurement,
the same family at its base showed 422 passed texts nested past the limit under the plain grammar
and 290 under each strict one,
and none after.

Open,
the agent's stated over-refusals:
a fence indented one to three columns,
a closing line indented four,
a fence in a container,
a fence line in an html comment or `pre` block,
every fence after a `$$` line under the strict grammar,
and a raw-text html block left open before a fence holding 256 or more brackets,
which the assembly guard then withdraws.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
the measure may refuse a text the parser reads,
never skip a stretch the parser nests.

### B322: the nesting scan read a line mixing stars and hyphens as a thematic break

Red in `d0aebf8a7`,
fixed in `71702c550`.

Found on 2026-10-06 (UTC) by the agent of B320.
`isRuleLine` took any line of stars,
underscores,
hyphens and blanks as a thematic break and skipped its emphasis delimiters,
where the grammar's break is three or more of one character.
By the agent's measurement,
`*-` repeated 24,000 times passed the scan and parsed in 3.7 to 6.6 s over four runs,
growing faster than the text.

The fix:
`isRuleLine` is the grammar's thematic break exactly,
three or more of one of `*`,
`_` and `-` with only blanks between,
and a mixed line is counted.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B323: a page nested past the bound by the join of two readable slices ended the document

Red in `d0aebf8a7`,
fixed in `71702c550`.

Found on 2026-10-06 (UTC) by the agent of B320.
An unclosed fence in one slice is closed by the fence line of the next,
whose open brackets then nest on the page,
so each slice read alone and the page did not.
`guardFootnoteAssembly` parsed the page and raised `MarkdownParseError` out of `repairPreparedDocument`;
the same guard runs for `translate-assemble.ts` and `page-assembly-rounds.ts`.

The fix:
`introducedStructuralRegressions` (`assembly-regressions.ts`) returns `unreadable-page`
when the assembled page is refused,
reading the incumbent first,
so an incumbent the grammar refuses still throws;
`assembly-integrity.ts` skips the footnote reading of an unreadable page,
and the guard's existing single-withdrawal proof withdraws the replacement that made it.
The lead's change to the agent's patch:
the function pairs each kind with the incumbent's count of it,
where the agent's version looked the count up by position with a `?? 0`,
which would have read a missing count as zero.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
the assembly guard reads the page,
not only the slices;
and "Defaults that stand in for an input" for the positional zero.

### B324: a page opening with a byte order mark was read as having no front matter

Red in `75ea14bff`,
fixed in `3ce947dce`.

Found on 2026-10-06 (UTC),
a residual the report behind B257 to B262 left,
measured by the agent of this fix.
`splitFrontMatter` looked for the opening fence at offset zero,
so a page whose first character is U+FEFF read its YAML as body:
a thematic break and a setext heading,
translated,
judged and counted in slices.
With a mark on the archive only,
the metadata slice was an insertion at offset zero,
so a rewrite wrote the new front matter before the mark
and left the archive's own in the body.
By the agent's census,
the pinned corpus holds no page opening with a mark (0 of 184),
so the defect is unreached by it.

The fix:
the fence is read after a leading mark (`leadingMarkWidth`,
`front-matter.ts`);
`FrontMatterBlock.raw` excludes the mark,
and the new required `startOffset` says where the fence stands;
every offset stays an offset into the text as written;
the metadata slice's spans start at each block's own fence,
and an insertion lands after the archive's mark (`targetInsertionOffset`);
a boundary after nothing but the mark is the start of the document;
and the archive intake (`corpus-run/pass-archive.ts`) keeps a leading mark and still folds every other.
The lead wrote the red commit's nine marks in the front matter cases as escapes,
where the agent's file held the character itself (M135).
The whole suite on `3ce947dce`,
run in a side checkout:
2,012 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 44 source scans passing.

Open to the owner's veto:
the ruling itself,
against the site:
`markdown-yaml-metadata-parser` 3.0.0 opens front matter only at `^---`,
and `readFileSync` keeps the mark,
so the site reads such a page as having none;
the alternative is to start at zero in `splitFrontMatter`,
everything else staying correct under both readings.
The intake keeping a leading mark while folding the others
(the alternative is to exempt U+FEFF from the fold);
and the mark outside the metadata slice,
so no lane rewrites it.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a rule about where a document starts is asked of one reader every consumer shares,
and a test pairs a page with and without the mark.

### B325: the slice parse welded the paragraphs a line holding only a mark parts

Red in `75ea14bff`,
fixed in `3ce947dce`.

Found on 2026-10-06 (UTC) while settling the one archive with marks for B324.
`parseDocument` blanks a line that shows nothing and is not blank to the parser before it parses,
and `parseSliceBody` did not,
so a slice holding such a line read as one block fewer than its page:
by the agent's measurement,
3,
2 and 3 blocks for the 4,
3 and 4 of three slices of `people/Toka_ls/page.en.md`.
The corpus pass folds the archive first,
so it did not reach production there;
the bench sampler slices raw text and does.

The fix:
`parseSliceBody` masks invisible lines first,
as the page parse does.

Open to the owner's veto:
a candidate line of a zero-width space alone is a paragraph break in the slice grammar.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
two parses of one text apply the same masks in the same order.

### B326: three readers of a tag name each kept a name of their own

Red in `75ea14bff`,
fixed in `3ce947dce`.

Found on 2026-10-06 (UTC),
the residual B262 left on its container tag readers.
The lone container tag masker took an ASCII letter and then everything up to the first whitespace,
the inline reader took that name and looked one character past it,
and the attribute restorer (`corpus-run/tag-attributes.ts`) took an ASCII letter and ASCII alphanumerics with `-`,
`.` and `:`.
By the agent's differential against `parseMdxBody`,
over 148,252 spellings in each of three places of a name,
the masker refused 49,018 starts the compiler accepts
(`$`,
`_` and every letter outside ASCII)
and read 97,431 characters inside a name the compiler refuses
(a zero-width space,
a bidirectional control,
a soft hyphen,
an `@`),
so a lone tag of such a name was masked as an element of that name where the slice should have been refused;
and over 282 spellings the restorer read 24 the compiler refuses and missed 84 it accepts.
The compiler hands the grammar UTF-16 units,
so a letter past U+FFFF starts and continues no name.

The fix:
one `readTagName` (`mdx-tag-name.ts`),
written from the states of `micromark-extension-mdx-jsx` 3.0.2
and the classes of `estree-util-is-identifier-name` 3.0.0,
used by the masker,
the inline reader and the restorer,
its start set shared with `opensMdxTag` (`mdx-tag-start.ts`).
`tag-name-spellings.test-fixture.ts` holds the differential set,
and each reader's test holds the reader to the strict grammar over it.
The agent's case pinned how many spellings the grammar accepts (106);
the lead's asserts that both verdicts occur,
and a check of a list's length against itself is gone.
The lead's change to the module comment:
it names all three readers,
where the agent's named two.

Open:
`nesting-inline-count.ts` reads a tag name of its own,
not brought to the definition and not measured;
`tag-attributes.ts` still reads attribute names with its ASCII set,
unmeasured.
Both closed since:
the nesting count by B344,
the attribute names by B345.
Corrected on 2026-10-06 (UTC):
the spelling set this entry counts as 282 yields 283 spellings,
277 of them distinct
(the lead's count of `tagNameSpellings()`,
unchanged since `75ea14bff`).

Open to the owner's veto:
`opensMdxTag` stays start-only,
so an angle autolink stays a protected span,
and its start set is the Basic Multilingual Plane's;
the restorer reads tags named in any script and refuses 24 shapes it read.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
one definition of a construct's name,
held by a differential case over every class of character against the compiler.

### B327: the destination scan read neither the character reference nor the bracket of the autolink trail rule

Red in `75ea14bff`,
fixed in `3ce947dce`.

Found on 2026-10-06 (UTC),
the forms B259 left open on the trail rule.
`micromark-extension-gfm-autolink-literal` 2.1.0 reads a well-formed character reference (`&amp;`)
and a closing square bracket as no part of an address when an end follows them,
and ends an address at a bracket before whitespace,
`(`,
`[` or the text's end.
The scan kept `&amp` in `see https://c.example/a&amp;`,
ended every address at the first `]`,
and the tree reader,
which takes the parse's own cut,
named the shorter address.
By the agent's differential over generated texts,
the two readers disagreed on 5,048 of 26,452.

The fix:
`readTrail` (`corpus-run/dropped-destinations.ts`) is the rule as one reading of what follows a candidate end,
`addressEnd` asks it at marks,
`&` and `]`,
`]` is no longer a stopper of a run,
and the tree reader's autolink literal is cut by the same function (`literalAddress`).
`destination-address-texts.test-fixture.ts` generates the texts.
The agent's generator moved its prefix and its path length in step with the suffix,
each chosen by the position's remainder alone,
so a suffix only ever met one prefix,
against its own comment;
the lead's pairs every suffix with every prefix,
and the case over 6,000 of its texts passes with no disagreement.
The lead's change too:
two TSDoc examples keep the escape of the full-width comma
that the agent's tool had written as the character (M135).

Open:
the scan still ends an address at ASCII whitespace only,
where the parse ends at any Unicode whitespace,
and the generator draws none.
Closed since by B346.

Open to the owner's veto:
an address now runs past a `]` the rule does not end it at.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a second reader of an address is held to the first by a generated differential,
and the generator draws every form of the rule.

### B328: a test helper sorted away the order the recheck guarantees

Changed in `75ea14bff`;
its red is the agent's measurement in its worktree,
since the cases pass on the stage as it stands.

Found on 2026-10-06 (UTC),
the helper a review had flagged without settling.
`missingChecksSorted` and `readingsInSeatOrder` put the findings and the ballots of every recheck verdict in order
before the cases of `refine-recheck.unit.test.ts` compared them,
for a gather order the stage no longer exposes:
`repair-edit-stages.ts` returns them in the roster's order.
By the agent's measurement,
with the roster ordering removed from the stage every case of the file still passed,
and with both helpers removed as well six failed.

The fix:
both helpers are gone from that file,
and its cases assert the roster order as the stage returns it.

Open:
`refine-slice-settle.unit.test.ts` wraps `readingsInSeatOrder` the same way.
Closed since by B343.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order":
a case asserts an order exactly,
never after a sort of its own.

### B329: a credential a provider echoed in another spelling left the transport unmasked

Red in `03ec6a4fc`,
fixed in `9a32c49`.

Found on 2026-10-06 (UTC) by a census of the forms a credential can take in a reply,
the item B266 left open:
a key in URL-encoded or base64 form was not searched for.
`maskCredentials` searched the header value and the token after its scheme word as written,
as a JSON string holds them and with the slash escaped.
A provider,
proxy or HTTP library that echoed the same key percent-encoded
(whole or in its reserved characters only,
in either hex case),
as a form value,
in base64 or base64url
(alone,
padded or not,
or inside a longer run at each of the three alignments),
as JSON unicode escapes
(once or inside a JSON string that is itself inside one),
percent-encoded inside a JSON string,
or as the decoded pair of a `Basic` header or the decoded form of a percent-escaped header,
handed it to every reader of the reply.
Nothing measured did this;
nothing proved none did.
By the agent's account,
nine cases of `credential-mask.unit.test.ts` failed by assertion on the old mask in its own worktree;
at the red commit that file cannot load,
since its cases read the needles through `needlesOf`,
which the fix exports,
so the gap shows there through the four surfaces that print a reply:
the transport's failure reply (`synthetic-transport`),
the masked JSON read of the two lookups (`masked-json-body`),
the listing (`corpus-run/provider-listing`)
and the cut stream's opening (`stream-drain`).
The lint failed at the red commit,
19 errors and 103 warnings,
each a use of an export the fix adds.

The fix:
`maskCredentials` finds every spelling of every credential in one Aho-Corasick pass
(`credential-search.ts`,
in place of a Knuth-Morris-Pratt pass per spelling);
reads the reply through JSON string escapes and percent escapes,
chained up to three deep,
each unit of a decoded reading mapped back to the stretch of the original it came from
(`credential-views.ts`);
and searches each credential as it stands,
as JSON writes it,
as a form value,
as the bytes of its UTF-8,
and in base64 and base64url at each of the three alignments a prefix of unknown length gives
(`credential-needles.ts`).
A base64 find takes with it the one character at each edge that holds bits of the key,
and the run's padding after the character that ends it.
`credentialsOfHeaders` adds what a decoder reads out of a header's secret:
a base64 body that spells printable text and each side of its first colon,
and the secret with its escapes resolved (`credential-decoded-forms.ts`).

The lead's changes to the agent's patch:
the widening counts only characters that hold bits,
so an `=` is no longer one of them,
and padding is taken only after a tail character the find took;
`Needle.padded`,
which marked every base64 needle and so had the mask take the `=` after a key ending on a whole group of three bytes,
is gone,
and two of the lead's cases hold both edges;
`FIXED_IN_TAIL`,
a table mapping zero,
one and two to themselves read with a `?? 0`,
is the arithmetic it stood for;
reads that cannot miss
(a view's typed-array offsets,
a find's needle,
a reach mapped back to the original)
throw on a miss,
where a zero would have placed a marker at the text's start and left the credential where it stands;
and three comment lines of `credential-views.ts` that held a hyphen where they mean its JSON escape
hold the escape (M135).

By the agent's account,
not rerun by the lead:
the cost per reply is one search pass
plus one decode pass per decoder chain that finds an escape decoding to a unit some needle holds;
under load,
plain replies within 1.1 times the old mask,
ordinary JSON replies within 1.4 times,
and the worst shape measured,
escaped backslashes in every frame,
12 to 20 times at 256 KB to 4 MB,
about 20 ms at 256 KB.
Out of reach by rule:
a key split by a line fold or a soft hyphen,
a spelling no decoder named here recovers
(hex,
HTML entities,
`\xHH`,
`\u{...}`,
a cipher,
a hash,
a case-folded key,
base64 of bytes that are no UTF-8 of the key),
and nesting past three decoders.
The whole suite on `9a32c49`,
run in a side checkout:
2,017 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 44 source scans passing.

Open:
by the agent's inference,
not measured,
`stream-drain.ts` logs `response.url` near lines 55 and 376,
which after a redirect is an address the provider chose,
unmasked;
and the `blind-map-writes` scan reads a typed array's `set` as a Map write,
so the patch wrote loops where `set` was the natural code.
Both closed since:
the address by B341,
the scan by B342.

Open to the owner's veto,
the agent's:
every credential header's secret is decoded,
not only a `Basic` one;
Aho-Corasick in place of the pass per spelling;
three decoders deep;
base64 needles for the whole header value as well as the token;
the plus form of every spelling;
the head minimum of four units for a cut text applies to the base64 spellings too;
the four helpers exported for built-artifact tests.
The lead's:
padding taken only after a tail character.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B330: eight log lines that print a provider's failure had no case through their own line

Red in `03ec6a4fc`,
fixed in `9a32c49`.

Found on 2026-10-06 (UTC) by the census of B329.
The lines of `image-reading-pair.ts`,
`corpus-run/required-providers.ts`,
`corpus-run/model-health-report.ts`,
`corpus-run/coverage-probe-run.ts`,
`corpus-run/window-trial-pick.ts`
and the abort warnings of `translate-slice-attempt.ts`,
`repair-refine-step.ts` and `repair-slice-buy.ts`
had no case reaching them with a status failure the real client raised over the real transport.
By the agent's reading,
no line was wrong:
each names the status,
the provider or model and the provider's own words,
and through the masked transport holds no credential.
The abort warnings are reached only where the abort fires while the provider refuses,
since `attemptStageCall` rethrows an error under an aborted signal unchanged.

The fix:
`provider-status-failure.test-fixture.ts` builds the failure
through the real `createSyntheticClient` over the real `fetchTransport`,
against a stubbed `fetch` whose invented provider echoes the key three ways,
and one case per line holds the whole line;
their red is the mask's gap of B329 showing through them.
`buyRepairSlice` is exported through `repair-chunk-barrel.ts` for its first unit test file,
and the own-unit-tests allow-list lost its line for `repair-slice-buy.ts`.
The suites that stub `fetch` for the process run one case at a time.
The lead's change:
the fixture's count of base64 characters its prefix fills alone (5) is derived from the prefix and named group sizes,
where the agent's file wrote the number.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B331: a damage case checked only that its text held the borrowed sentence

Fixed in `e1c84094e`.

Found by a cross-check of the four review reports on the trial's test cases against the branch,
one of six findings the cross-check left open.
The case that skips an empty donor sentence and borrows the first usable one
(`fidelity-damage.unit.test.ts`)
asserted that the damaged text contains the borrowed sentence,
which a sentence set anywhere,
or a wrong count or detail line,
also satisfies.

The fix:
the case asserts the whole attempt:
its kind,
the damaged text with the sentence set after the clean text's second sentence,
the changed count and the detail line,
each count derived from the borrowed sentence's length.
The lead measured that value from the built library before writing it
(by the lead's notes,
89 changed characters,
the borrowed sentence's length).
The whole suite on `e1c84094e`,
run in a side checkout:
2,017 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 44 source scans passing.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail":
a case over a pass that rewrites text asserts the whole text it returns.

### B332: the real corpus pin stood as fixture data in nine test files

Fixed in `e1c84094e`.

Found by the same cross-check,
which named one file (`corpus-run/editor-standing-read.unit.test.ts`);
the lead's search found nine,
writing the pin in full or cut to seven or nine characters,
five of them in the seven-character form.
Each case records,
prints,
parses or abbreviates the id,
and none reaches code that checks it against the pin,
so the real commit stood where any object id does.
The owner's ruling of 2026-10-05 (UTC) that the corpus is public covers corpus text,
and by the lead's reading of it unit fixtures stay invented.

The fix:
each of the nine writes an invented id (`feedface` repeated,
or cut as the case cuts it),
and every one passes with it.
Comments that cite the pin as where a count was measured keep it,
since that is what they record,
and so do the production examples that show the package's own pin.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B333: case names and a comment cited clusters the ledger never names

Fixed in `e1c84094e`.

Found by the same cross-check.
Six case names in `fidelity-damage.unit.test.ts`,
`openrouter-cost.unit.test.ts` and `translate-skeleton.unit.test.ts`
ended citing "the fidelity cluster" of ledger T8 and the like,
and a comment of `group-run-anchor.ts`,
which the cross-check did not name,
cited "the group cluster";
no ledger entry names those clusters,
so no reader could open what they cited.

The fix:
the names say what they test and nothing more,
and the comment cites the ledger's T8 section alone.
The numbered-batch citations elsewhere stay,
since the ledger names each batch:
by the lead's count,
the sixth 9 times,
the ninth 7,
the twelfth 5,
the eighteenth 7 and the twenty-third 5.

Recurrence:
`mistake-prevention.md`,
"References in code and docs".

### B334: a read fault a case made with a file mode held for every user but the superuser

Fixed in `e1c84094e`.

Found by the same cross-check.
The slice cache's resume case (`corpus-run/slice-cache-namespace-resume.unit.test.ts`)
made a file unreadable with mode `000`,
which a superuser reads anyway,
so the case failed whenever the suite ran as root.

The fix:
the file is made one byte past the largest Node's `readFile` reads,
2 GiB,
held sparse so it takes no disk;
Node refuses it from its size before reading,
whoever runs the suite,
and the case asserts that refusal's whole text,
`RangeError [ERR_FS_FILE_TOO_LARGE]: File size (2147483648) is greater than 2 GiB`
with the size written from the case's own constant.
The lead measured the refusal's text on Node 26.10.0 with a sparse file of that size.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".
