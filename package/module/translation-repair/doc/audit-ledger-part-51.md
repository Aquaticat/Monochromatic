# Audit ledger, part 51

Part 51 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Process mistakes in this audit, continued

### M113: guards removed, and named errors flattened, to close census stretches

Status:
found 2026-10-05 (UTC),
reading the MiMo trial's production diff once the trial was merged;
the sites named here were fixed the same day,
and this entry grows as the rest of that diff is read.
The trial's handover told it that every census stretch ends cased,
unreachable and removed,
or a fixed defect,
and to take the census again until its counts read zero.
A guard that must stay and can never run fits none of the three.
M112 records the trial's answer,
that the dead branch comes out,
which inverts the package's rule for a broken invariant:
a state no input produces is refused out loud,
never passed on.
The answer was applied in three shapes.

Guards taken out with nothing in their place.
Each is restored as a throw whose message opens `unreachable:` and says what was found:

- `reanchorInsertions` (`group-run-anchor.ts`) wrote `NO_BOUNDARY`,
  minus one,
  as an insertion's offset when no translation block stood on either side of it;
- `anchorOffsets` (`group-source-anchor.ts`) named `NO_OFFSET` as an anchor
  in a walk whose paired steps index past the translation blocks;
- `occursOnce` (`fidelity-alteration.ts`) answered that a number missing from its passage occurs once,
  since its second search then ran from the passage's start and found nothing;
- `extractAnswer` (`grade-sheet-read.ts`) cut the opening characters off a heading without its grade marker
  as though they were the marker;
- `scanUrlRuns` (`corpus-run/dropped-destinations.ts`) left its cursor where it stood
  for a run that consumed nothing,
  which is a loop without an end;
- `describeRows` (`corpus-run/bench-report.ts`) returned `'no rows'` for an empty group,
  and with the return gone an empty group printed `NaNms per slice`;
  `summarizeBench` groups rows by a width and a pass read off those same rows,
  so no group is empty (restored in `f3b0d5db3`);
- `restoreHeading` and `restoreSignature` (`corpus-run/contributor-name-restore.ts`)
  returned `UNCHANGED` where the rebuilt line equals the line,
  and with the arms gone such a line read as rewritten,
  with a finding restoring it to itself;
  a rebuild equal to its line means the written name already is the rendering,
  which `carriesRendering` has answered before either is called
  (restored in `f3b0d5db3`;
  the writing agent measured 98,576 Han code points through the pinyin reader
  and 400,000 seeded pages through the built pass,
  neither reaching the throws).

Named errors flattened to `nonNullishOrThrow`,
whose whole message is `Expected non-nullish value, got undefined`.
The explicit throw's own line read as cold,
and `nonNullishOrThrow`'s throwing arm lives in another package,
outside the count.
The two `unreachable:` throws of `coverage-candidates.ts`,
naming the matcher and the aligner,
are back with their words,
and in `f3b0d5db3` two more,
each `RenderingAuditInvariantError`:
`withCitedReferences` (`corpus-run/rendering-audit-settled-buy.ts`) names the entry and the slice
whose page was never read for references,
and `subjectsOf` (`corpus-run/rendering-audit-settled-subject.ts`) refuses a row that passed the decided filter and is not decided.
The trial had removed that throw behind a type predicate,
which the compiler does not check against the filter's body,
and left the `@throws` describing it;
the filter returns `boolean` again.

One conversion of a fallback into `nonNullishOrThrow` was a regression,
not a flattened invariant:
`stampOf` in the cap census,
ledger B132.

Parameters added to production functions so that a case could reach a branch,
every one defaulting to the production value,
which M70 forbids:

- `fold` on `canonicalize` and `anchorLocatedSpan` (`rendering-audit-anchor.ts`),
  which let a case break the length invariant the function checks.
  The parameter and its case are gone;
  the invariant's `RenderingAuditInvariantError` stays.
- `needle` on `deleteOneSentence` (`fidelity-damage.ts`),
  which let a case name a sentence the text lacks.
  The parameter and its case are gone,
  and the arm they reached,
  an unchanged twin reported as an undamageable slice,
  is an `unreachable:` throw:
  `anchorSentence` draws the sentence from the text
  and `spliceOutSentence` returns its input only for a sentence the text lacks.
- `anchor` on `insertBorrowedSentence` (`fidelity-damage.ts`),
  gone with its case.
  The arm the trial removed beside it stays removed:
  `applySeededErrors` throws for a splice point the text lacks,
  and a splice it makes adds the borrowed sentence,
  so its result always differs from the clean text.
- `ocrTool` on `readImageWithOcr` (`image-ocr.ts`),
  which named the reader's program so that a case could name one that is not installed.
  Beside it the trial added five cases that run the real `magick` and `tesseract`,
  which the test file's own header rules out:
  a unit test must not depend on programs and language data a machine may lack.
  A required seam for the programs the function runs is to replace the parameter and those cases;
  this entry is completed when it lands.

Removals read against their callers that stand:

- `targetSize` (`coverage-tail.ts`) dropped its insertion check:
  `readUntranslatedTail` sizes only slices `isPaired` passed,
  and `makeInsertionChunk` keeps an insertion's text empty,
  so every reachable input sizes as it did.
- `openRouterChunksOf` (`openrouter-chunk-scan.ts`) dropped its opening-brace check,
  and now agrees with the completion reader (`stream-completion.ts`),
  which parses every payload that is neither empty nor the sentinel:
  a chunk whose payload opens with spaces is read by both,
  where this scan used to skip it and lose its cost and endpoint.
  Its TSDoc still described the check;
  it describes the parse now,
  and an `openrouter-cost.unit.test.ts` case reads a cost off such a chunk.
- `anchorOffsets` reads its walk through `nonNullishOrThrow` inside a loop bounded by the walk's own length,
  an element read that never had words of its own.

Test cases the trial added that could not fail,
read by three independent reviews of its test additions:
`33ea944b4` corrects eight corpus-run test files
(`published-page-check`,
`meter-sample-read`,
`meter-dry-span`,
`final-selection-completeness`,
`list-spread-restore`,
`rendering-audit-settled-input`,
`slice-census-entry`
and `spend-read`),
each case now asserting a whole result on an input where the code it names decides it,
and case names lose the tags naming the T8 batch and cluster that wrote them,
which said nothing about what a case asserts.
`f3b0d5db3` corrects the test files of its own modules the same way.
The production defects such cases pinned as intended,
or could not see,
are B128,
B130,
B131,
B133 and B139.

Found beside these:
`groupNodesSealed` returned no runs at all,
without a word,
for a supplied walk pairing past the translation blocks
(two source blocks,
one translation block,
a paired step naming the fourth:
`{"runs":[],"sealedSourceIds":[]}` on the build of `7f069adc9`);
decided and fixed as B138.

Open when this entry was written,
closed in B197 to B200,
found by the agent that wrote `f3b0d5db3`:
the slice census sizes an added block by the block the aligner left over,
so an added paragraph of 42 or of 213 characters reads as 39,
since `estimateExpansion` (`align-blocks.ts`) divides a section's whole translation by its whole original
and the added block raises the length expected of every rendering
(the cause read off the source,
not measured in a fork;
`slice-census-entry.unit.test.ts` asserts the column only where it reads right);
`restoreHeading` cuts the page title at its last colon to find the prefix,
so a rendering that holds a colon is written twice into its heading,
`### Three: Mao: Cat` becoming `### Three: Mao: Mao: Cat` with a restore reported
(the agent's probe;
the code is older than the trial,
and which colon ends a prefix is a design choice);
`finalSelectionFindings` reads an artifact whose contest never ran as nothing to report,
an arm no production input reaches,
since `settledEntryArtifact` writes its kinds as literals;
`censusEntry` counts translation-only blocks with the deterministic aligner even under a settled recipe,
so a settled row mixes two carves (read,
not probed);
and `readLists` (`list-spread-restore.ts`) drops a list whose item has no offsets,
silently,
which would move every later list's position
(the parser sets positions on what it parses,
an inference).

Prevention:
`mistake-prevention.md`,
"Guards a census wants gone".

Closed on 2026-10-05 (UTC) for the `ocrTool` seam (`e300e6c33`,
`d550bf04f`):
the seam landed in place of `ocrTool`.
`readImageWithOcr` (`image-ocr.ts`) requires `runProgram`,
a `ProgramRunner` both decoders and the OCR reader go through,
and `decodeToPng` takes the same runner;
nothing defaults it.
The real runner is `runInstalledProgram`,
named once,
where `RUN_PICTURE_SOURCES` (`corpus-run/pass-visual-evidence.ts`) binds it through `ocrReaderOver`.
The trial's five cases ran the real `magick`,
`dwebp` and `tesseract` with `chi_sim` data,
and the older undecodable case relied on the real decoders failing;
all six are gone.
Every case of `image-ocr.unit.test.ts` about the reader now runs through `scriptedPrograms`
(`scripted-programs.test-fixture.ts`),
which starts no process
and whose stand-ins copy,
transcribe,
refuse or are missing at the paths the reader names,
and each case asserts the reading,
the programs run with their arguments,
and every line logged.
The stand-in rejections copy Node's spawn and exit failures field for field,
and two cases hold them against the rejections `runInstalledProgram` raises.
Prevention:
`mistake-prevention.md`,
"Tests touching the real world":
a program on the machine is an outside read like the corpus,
and its runner is a required parameter.

Removals read against their callers and left standing on 2026-10-05 (UTC)
(`df0bcb85a`,
`ba243b3c3`,
the verifying agent's reading):

- `attachClaimFilers` (`claim-filers.ts`) reads a claim's filers through `nonNullishOrThrow`
  behind the filter that kept the claim for that very key.
- `containerHalfPairs` (`container-half-pairs.ts`) reads the half it splices out through `nonNullishOrThrow`;
  the index comes from the same list's `findLastIndex`,
  checked against not-found first.
- `classifyDisplacement` (`displacement-class.ts`) reads a slice's class and a high slice through `nonNullishOrThrow`;
  both arrays are maps of the same readings.
- `listedNames` (`edit-prompt.ts`) reads the last name through `nonNullishOrThrow`
  in the arm taken only for two names or more.
- `declinedTargetBlocks` (`declined-target-runs.ts`) keeps its `nonNullishOrThrow` node read,
  behind the checks every production path makes first,
  `blockPairingToSteps` and `walkIntoRuns` (B138);
  the comment that credited the alignment for it now names them.
  The verifying agent found,
  on a base before B138,
  that a pairing read back from a settled artifact naming a block past the section reached that read,
  declining every block or throwing a missing-value error that named nothing,
  and refused it in this module with a `RangeError`;
  B138's `BlockPairingError` now meets that pairing upstream,
  so the merge kept B138's refusal,
  and two cases in `declined-target-runs.unit.test.ts` pin it through this module's entry.

Named errors flattened to `nonNullishOrThrow`,
one more
(`49f3ebdbf`,
`699ad2f8c`):
`readImagePair` (`image-reading-pair.ts`) named the roster slot of a reader whose exchange threw
with an explicit throw,
and the trial replaced it with `nonNullishOrThrow`
and a comment crediting a capability gate.
The slot is present because the settlements are the roster mapped one ask per slot;
the throw is back with its words,
in the `unreachable:` form,
and the comment gives that reason.

A check cut in half so that another would run:
`inspectParagraph` (`inspect-paragraph.ts`) lost the kind half of its structure check
so that the leading-block check behind it went live,
which moved a heading beside broken definitions from `not-one-paragraph` to `unparseable`
(B157).
The check is whole again,
and the leading-block check is an `unreachable:` throw.

### M114: a commit left without its lint, and a setup command read by its task status

Status:
both happened on 2026-10-05 (UTC) and were caught the same day.

The commit.
`f0f449765` corrected eight test files and was made on named tests alone;
its message said the whole suite,
the lint and the scans would run with the following change.
Work went to agents instead,
and the gates started only when a reviewer's advice asked for them.
Run on that commit itself,
they passed the suite and the scans and read `Found 1 warning and 0 errors.`:
an expectation written `3072` where the lint wants `3_072`
(`openrouter-cached-tokens.unit.test.ts`).
`30c9bd8e6` fixed it,
sixteen minutes after the commit by the two commit stamps.
Twelve agent worktrees then stood at `f0f449765` (`git worktree list`),
so each agent's lint reported the warning and each had to be told it was known.

The setup command.
The script that creates agent worktrees was run under `mise exec --`,
where `git` is the plain program and not the repository's wrapper;
plain `git` does not know `--no-worktree-copy`,
and the script stopped at its first worktree,
twice.
Each run was in the background behind `|| echo "exit $?"`,
so its task reported exit code 0.
The report was taken for the result,
neither log was read,
and an agent was launched into a worktree that did not exist.
It was found when a `cd` into another of those worktrees failed;
the worktrees were then made without `mise exec --` and the agent was told.
`mistake-prevention.md` already had the rule,
under "Tasks,
builds and bulk output" (ledger B103):
a background run is read by its own log,
never by the task's reported status.

Prevention:
a commit that defers its gates starts them in the background in the call after it;
"with the next change" names no time.
A command that sets up what a later step uses is read by its log before that step starts,
and a path an agent is sent to is listed in the call that sends it.

Recurred on 2026-10-05 (UTC),
the lead's own:
merging `341211543`,
the lead edited `coverage-control-probe.ts` beside the agent's patch
and committed after `lint:types` and the named tests,
without the source scans;
the commit's message said so.
The count-nouns scan then failed the whole suite and the scans on `ba243b3c3`,
on a line the lead had written,
and `d233f882f` reworded it.
A hand edit made while merging is checked like any other change:
the scans run before the commit,
not only in the gates after it.

### M115: an invariant throw counted as code no test ran

Status:
found 2026-10-05 (UTC) on review of M112,
fixed in `c1f846ddb`.
The delegated agent that wrote the change drafted this entry under the code M113,
which was taken by then.
M112's prevention said the dead branch comes out rather than throwing from it,
and that an `unreachable:` throw counts as one more uncased line.
That inverts the package's rule,
under which a broken invariant throws `new Error('unreachable: ...',)`,
and it made the census a standing reason to delete every such guard:
no honest input reaches one,
so each read as code no unit test ran for ever.
By the agent's count,
`rg --fixed-strings 'unreachable:' src --glob '!*.test.ts' --count-matches` printed 42 in 24 files,
29 of them keys and type members named `unreachable`;
the unminified coverage build held 13 such throws,
and the whole-suite census `census-aU1H0y` at `9fe80a109` left nine of them cold:
`src/artifact-change-sets.ts` 212 to 215,
`src/artifact-read.ts` 138 to 150,
`src/budget-hold-wait.ts` 188 to 191,
`src/chunk-measure.ts` 245 to 248,
`src/cited-reference-scan.ts` 272 to 277,
`src/corpus-run/published-page-check.ts` 556,
`src/dedupe-issues.ts` 160,
`src/splice-slices.ts` 263
and `src/transient-retry.ts` 584 to 585.

The census now reads each cold stretch's own text in the coverage bundle in one linear pass
(`coverage-stretch-atoms.ts`,
`coverage-invariant-throw.ts`).
A stretch in which every statement throws `new Error(...)` whose first argument is one string or template literal beginning `unreachable:`,
or a class whose name ends in `InvariantError`,
is an invariant throw;
braces,
a semicolon,
`else` and the `if` head guarding a throw may stand in it,
and anything else keeps the whole stretch cold,
as do a slash the pass cannot tell for a division or a pattern
and a function no process called.
`placeTally` places such stretches apart,
so no row,
total or baseline reading counts one,
and the report prints their count beside the cold counts and lists each by source,
lines and class thrown.
The census file is format 3 (`CENSUS_FORMAT`) and keeps them under `invariantThrows`;
`readBaselineCensus` refuses format 2 by name,
since its stretches hold invariant throws among the cold code with no text to tell them by,
and read against a run that leaves them out each would read as ran.
Replayed through the changed build with no test run
(a replay script in the agent's scratch),
`census-aU1H0y` reads library source as 83 files and 110 stretches over 273 lines,
with nine invariant throws,
which is the 90 files,
119 stretches and 309 lines it recorded.
None of the nine is of the class form,
whose six throws tests reach.

A whole-suite census of the change has not been taken on the branch yet.
The one the agent ran refused on a failing suite:
`bench-sample-draw.unit.test.ts` reaches `git` through a shim whose `git-policy-cli` build its checkout lacked.
Of the 286 `census.json` files under the package's coverage cache on this machine,
none was written after `c1f846ddb`,
so every stored baseline is format 2,
and the next census is taken without one and becomes the baseline.

Prevention:
an `unreachable:` throw stays,
the census counts it apart,
and a guard is never removed to close a stretch.
A stretch closes by a case that reaches it,
or,
where no honest input does,
it is left to the invariant count.
This supersedes M112's prevention,
and T8's rule that a span no runtime value can reach is removed as dead code is read with it:
a span that guards an invariant is not dead code.
`mistake-prevention.md`,
"Guards a census wants gone".

### M116: three more shell commands chained with `;`

Status:
happened 2026-10-05 (UTC),
three times in one session,
after M107 had recorded four the same day;
every step only read,
so no file was changed by them.
A listing piped to a search and chained to a count (`ls … | rg … ; wc …`),
a count chained to a search of the same file (`rg --count … ; rg …`),
and a patch check chained to its statistics (`git apply --check … ; git apply --numstat …`).
Each second step ran whatever the first returned,
so the last call would have printed a patch's statistics beside a check that had failed.
Prevention:
M1 and M107 stand as written,
and recording the slip has not stopped it,
as M1 says;
one call holds one check,
or at most three steps joined by `&&`,
and two checks whose results are both wanted go in two calls of one parallel batch.
After this entry was written the slip came once more the same day,
a `git diff … | rg …` chained to a second `rg` with `;`,
so the record did not stop it.
It then came twice more.
A red log was read with two searches joined by `;` (`rg … ; rg …`),
on 2026-10-05 or 2026-10-06 (UTC),
the hour not established.
On 2026-10-06 (UTC) a source-scans log was read with `rg --count … ; rg '^exit ' …`,
the second search there to show an exit line the first count could not.
That makes three slips after this entry was written,
each a read whose two halves were both wanted,
which this entry's own prevention sends to two calls of one batch.
What would stop it is a check of the command's text before it runs,
which no hook makes yet.
Five more slips followed,
the fourth to the eighth after this entry was written,
around the merges of 2026-10-06 (UTC).
Two were quick looks while merging:
a listing redirected to a file and chained to a count,
and a listing piped to a search and chained to a count of another file.
Two put `;` between an `rg --count` and a second command,
to get past the count's exit of 1 on a count of zero,
and one put it after a search expected to find nothing.
What failed each time is that a command meant only to look was sent without being reread.
Every command is reread for `;` before it is sent,
a read-only one included,
and a count that may be zero is a call of its own.
Two more came on 2026-10-06 (UTC),
the ninth and tenth after this entry was written,
both reads of a log between two steps of a merge:
`rg --count … ; rg …` over a red commit's logs,
and `rg … | rg … ; rg --count …` over a named run on a fix tree.
An eleventh came the same day in the docs fork of batch six:
two `git diff --no-index` calls chained with `;`
while it wrote the diffs of its edited copies for the lead.
The twelfth to the fourteenth came the same day from agents,
each disclosed in its own report:
the agent of B339 twice,
a search chained to a counted listing
and a status read chained to the write of its hand-back patch,
and the agent of B341 to B348 once,
a search of a barrel chained to a print.
`mistake-prevention.md`,
"Shell commands".

### M117: a line-range `sed --in-place` aimed by a count off a print that had lost a line

Status:
happened 2026-10-05 (UTC),
while merging the footnote mention fix on the main checkout,
seen in the next read and repaired before any commit.
To replace two lines of a TSDoc in `footnote-mentions.ts`,
the lines were printed with `sed --quiet` and without their numbers,
against M93's prevention,
and counted from the range's first address.
The print opened on a blank line,
which the tool's output trimmed,
so the count started on the wrong line,
and `sed --in-place '202,203c\…'` replaced lines other than the two meant.
The block was repaired with the Read tool and one Edit.
M93 records line numbers worked out and not read;
here they were read,
off output that no longer matched the file line for line.
Prevention:
a replacement of more than one line is a Read and an Edit,
which match by text and fail where the text is not there.
Where `sed --in-place` is used,
each printed line carries its own number from the file,
by M93's form or by `cat --number <file> | sed --quiet 'A,Bp'`,
never a count from the range's start.
`mistake-prevention.md`,
"Lint and edits".

### M118: a count an agent's permission check refused, asked of the lead

Status:
happened 2026-10-05 (UTC);
nothing was run on the agent's behalf.
An agent fixing three first-match sites was to count over the pinned corpus
how many slices link one title twice
and how often a pair's wording stands on more than one line of a slice.
Its first command that touched the corpus clone was refused by the permission classifier inside the agent,
with no reason given.
It tried no other form,
handed back its fixes with their fixture cases,
and its report asked the lead to run the counts or to clear the permission.
The lead ran neither:
doing for an agent what the agent's own permission check refused goes round that check,
whoever holds the wider permission,
and coaching the agent to another command that reaches the same read does too,
which is M73's attempt made through a second pair of hands.
The counts stand as untaken,
for the owner to authorize,
and the one decision that leaned on them is recorded as made without them:
the pair bound says nothing where a wording stands a different number of times in the two texts.
Prevention:
a count an agent was refused is reported to the owner as untaken;
the lead neither reruns it nor shows the agent a way round the refusal;
and what was decided without the count says so where it is recorded.
`mistake-prevention.md`,
"Shell commands".

### M119: a Markdown lint started in one checkout that read another

Status:
happened 2026-10-05 (UTC) in `441de9d2b`,
found by the agent writing the next docs commit,
fixed in `5f4c38d96`
and corrected by a comment on `441de9d2b`.
That docs commit was written by an agent in a side checkout,
and its message reported that the Markdown lint found nothing in either doc.
The lint command the agent was given runs a script from the audit's scratch,
which holds the main checkout's path as a constant and reads the named files under it,
whatever directory it is started from.
Started in the side checkout,
it linted the branch as it stood before the agent's edits.
On the committed text the lint reports one `semantic-line-breaks` finding in each doc,
on the owner's quoted ruling.
M106 already says a message reports the lint of the bytes it commits;
here the bytes linted were another checkout's,
and the script's output named the files by their path under the root without naming the root.
Prevention:
a check run for a side checkout takes that checkout's root as an argument,
and its verdict is repeated only beside the root it read;
a script that holds a root as a constant is not handed to an agent working elsewhere.
A copy of the lint that takes the root first was written for the next docs commit,
and prints the linter's exit beside each file.
`mistake-prevention.md`,
"Commit messages".

### M120: an agent ran a built command with the run's keys, from its own shell

Status:
happened 2026-10-06 (UTC),
from 05:55:21Z to about 05:57:28Z,
stopped by the agent that started it;
telling the owner is the lead's,
and the lead's notes list it as owed.
An agent moving `verify-published` and `window-trial-probe` into modules,
a runner cluster not merged at `f8e99b84d`,
ran the built `window-trial-probe` from its shell and not through the keyless fixture,
to capture the unmoved command's output.
It meant the run to hold no key and stripped the environment by hand.
The command started `env` with a list of `-u` options built by
`$(env | rg '_API_KEY=' -o | sed 's/=//' | sed 's/^/-u /' | tr '\n' ' ')`
and then `node` on `dist/final/node/window-trial-probe.mjs`.
`rg -o` printed only the matched text `_API_KEY=`,
never a variable's name,
so nothing was unset.
The same command unset the corpus clone variable,
so slices were drawn from the operator's real clone.
The agent noticed when the call was moved to the background at the tool's limit of 120 s,
and stopped it by its task id.

What it bought,
read by the lead from the agent's two capture files
(`wtp-out.txt`,
17 lines,
and `wtp-err.txt`,
one line,
in the agent's scratch):
three credit and quota reads,
and one translate round of six calls.
Bedrock `google.gemma-4-26b-a4b`,
0.00067 USD printed;
Hyper `glm-5.3-flash` and `minimax-m3`,
token counts only;
Synthetic `hf:moonshotai/Kimi-K3` and `hf:Qwen/Qwen3.8-27B`,
token counts only;
OpenRouter `inception/mercury-2.5`,
0.00080 USD printed as estimated and abandoned,
after a 504.
The METERS line of that run printed the accounts' balances.
The run's scratch runs directory is empty,
so no ledger was written.
Neither capture file holds a key or a passage.

Why the agent's shell had keys at all:
every tool shell of the session holds the keys,
which it inherits from the session's own environment
(the agent counted 23 `_API_KEY` variables,
and the lead counted 23 the same day in a plain shell inside a side checkout,
one whose task runner had been told to unset them).
The keyless fixture of B291 covers a child a test starts.
It covers nothing an agent starts by hand.

What the lead did:
told the four agents still running,
by message,
never to start a built command except through `runBuiltCommand` or `runKeyless`,
and never to strip an environment by hand;
and added the rule to the notes file later agents read.

A second agent,
moving `judge-fidelity-probe` and the settled rendering audit,
started the built `judge-fidelity-probe.mjs` three times from its shell with the keys present,
before the lead's warning reached it,
and disclosed it in its hand-back.
Its account:
`--cap kitten` ended at the cap refusal,
exit 6;
`--cap 1 --candidates hf:cat/none --candidates-alone` ended at the not-seatable refusal,
exit 6;
and `--cap 1 --candidates deepseek-v4.1-flash --candidates-alone`,
with the clone variable set to an empty scratch folder,
printed the `judges:` line and ended at a failed corpus read,
exit 6.
The lead's reading of `src/corpus-run/judge-fidelity-probe.ts` as it stood:
the argument read,
`probeRosterWith`,
`reviewedFidelityRequest` and `readReviewedFidelityReferences` all come before `createRunClient`,
and nothing before them asks a provider.
No output file of those three runs was kept,
so where each stopped is the agent's account and not a measurement.

A third agent's probe,
in the cluster of B305,
started built commands with an environment built by hand:
a fresh object taking every variable whose name neither ends `_API_KEY` nor begins `TRANSLATION_REPAIR_`,
then four scratch settings.
Read by the lead,
that strip removes what the fixture removes.
It predates the rule,
and it is the shape the rule forbids,
because a wrong one fails without a word,
as the first agent's did.

Prevention:
a built command is started only through `runBuiltCommand` or `runKeyless` of `src/child-environment.test-fixture.ts`,
by an agent as by a test,
and an environment is never stripped,
filtered or rebuilt by hand.
A strip built by filtering the printed environment was never shown to remove a key;
the fixture's own test starts a real child that prints the names it sees.
Not closed at `f8e99b84d`:
a shell in a worktree still holds the keys,
and whether they should reach every such shell is the owner's to decide.
Since `3d36ba7b9` (B319),
a built command refuses to run in a process that holds a key
unless that process names the command as the one it means to start,
as the command's task does,
so by the guard's rule the start this entry records would have ended at that refusal;
a shell in a worktree still holds the keys,
and a script importing the built library is outside the guard.
`mistake-prevention.md`,
"Tests touching the real world" and "Guards that cannot fail".

### M121: a test fixture merged unread started a child with the keys in its environment

Status:
happened 2026-10-06 (UTC) in `5723cd071`,
found afterwards by the lead,
fixed in `cebfcc122` (B291).
That commit merged a coverage cluster's cases with a new fixture,
`corpus-run/built-child.test-fixture.ts`,
which starts a node child on the built package through `nano-spawn` with only the working directory set.
`nano-spawn` merges what it is given into the parent's environment,
so the child got the parent's environment whole,
and every whole-suite run from that commit until the fix started it with the key variables present.
The child calls `resolveGit()` only;
no key was used or shown.
The lead's review of the patch printed its production sections and skipped the untracked fixture.
The commit's own message lists the fixture among the choices open to the owner's veto,
"as an unrestricted child",
so the agent had said what it was.
Prevention:
the lead reads every new fixture of a patch,
since a fixture can start a process;
and the scan of B291 fails a test file or fixture that starts a child outside the shared keyless fixture.
`mistake-prevention.md`,
"Tests touching the real world".

### M122: a fix committed after a named run that left out a file holding the old wording

Status:
happened 2026-10-06 (UTC) in `4c26a48a0`,
found by the whole-suite run on that commit,
repaired in `495f040b6` (B235).
The fix changed what `StreamCutShortError` says of its cause.
Before the commit the lead ran 35 named test files,
and `stream-idle-guard.unit.test.ts`,
which asserted the old wording,
was not among them.
The suite was red at that commit:
1,624 `[PASS]` lines and 3 `[FAIL]` lines,
all three one case and its two enclosing suites.
Prevention:
when a message's wording changes,
the named list holds every test file that holds the old wording,
found by a search for the old words over `src` and not by the list of files the patch touches.
`mistake-prevention.md`,
"Searches and censuses that miss".

### M123: a red commit made without the source scans

Status:
happened 2026-10-06 (UTC) in `f45278048`,
found on the fix tree,
fixed in `71974714f`
and corrected by a comment on `f45278048` (commitcomment-203621236).
The red commit's message names three test files as failing on purpose.
The `duplicate-bodies` scan failed there too:
two test files,
written by two agents and landed in the last two test commits,
each projected an envelope with one body.
The lead had run the named test files and the type check before that commit,
and not the scans.
M114 records a commit left without its lint;
a red commit adds test files as well,
and the scans read those.
The fix commit adds `envelope-span.test-fixture.ts`,
which both test files use.
Prevention:
the source scans run before a red commit too,
and a message that names what fails names every failure of its tree.
`mistake-prevention.md`,
"Lint and edits".

### M124: a count of matching lines taken as proof a form was in use, and a commit without its lint

Status:
happened 2026-10-06 (UTC) in `71974714f`,
found by the whole-suite run on that commit,
fixed in `230623bec`.
The fixture M123 records exported `envelopeSpanOf`,
which two test files passed by reference to `map`.
Before choosing that form the lead counted lines matching a pattern for it in the package's tests,
took 26 matching files as proof the form was in use,
read none of them,
and ran no lint.
The linter warns on the form where it cannot see the function's arity across an import
(`no-array-callback-reference`),
and the run on `71974714f` ended its lint with one warning.
`envelopeSpansOf` takes the envelopes and maps them itself.
The commit went out without a lint run,
which M114 already forbids.
Prevention:
precedent is a match that was read,
beside the check that enforces the form,
never a count;
and lint runs before a commit that adds a helper,
not the scans and the type check alone.
`mistake-prevention.md`,
"Searches and censuses that miss" and "Lint and edits".

### M125: the count of pass lines read as if it could show a failing case

Status:
recorded 2026-10-06 (UTC) from the lead's directive for this docs batch,
which lists a gate result read from a pass line while a fail line stood.
The lead's notes hold the fact behind it and no account of the reading,
so which result was read so is not established here.
The fact:
a suite with failing cases still prints a `[PASS]` line listing the cases that passed,
so the count of pass lines does not move when a case fails.
The whole unit suite printed 1,823 pass lines on the tree of `cebfcc122` with two red test files in it,
beside 10 fail lines,
and 1,823 on `040656c51`,
beside none (B291).
B277 had already shown that the count is of suites that print and not of cases.
Prevention:
a run is green when its count of `[FAIL]` lines is zero and its exit says so;
the count of `[PASS]` lines is quoted beside that and never in place of it.
A background command that ends in an `echo` of its exit code reports success whatever ran,
so its log is read.
`mistake-prevention.md`,
"Claims without their evidence".
