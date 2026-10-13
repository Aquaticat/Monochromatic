# Audit ledger: process mistakes, agents and briefs

What went wrong in delegating work:
briefs that left something out,
agents that broke their rules,
and work merged from parallel briefs.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## M118: a count an agent's permission check refused, asked of the lead

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

## M120: an agent ran a built command with the run's keys, from its own shell

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

## M121: a test fixture merged unread started a child with the keys in its environment

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

## M126: an agent stopped its own census by a pattern that matches every agent's

Status:
happened on 2026-10-05 or 2026-10-06 (UTC),
the hour not established,
disclosed by the agent in its hand-back.
The agent of the coverage cluster over the `corpus-run` files (B272) had listed a test file that does not exist,
and stopped its own coverage census with `pkill -f` on the census command line,
twice,
by two patterns.
Those patterns match any agent's census on the machine.
Its own shell died,
and it could not rule out that another agent's census was stopped.
No other run is known to have been lost:
the census of the cluster over the library files from a to l finished,
and the agent of the cluster from m to z,
told by the lead,
reported that its one census finished normally.
The lead's brief gave agents a long-running command and no rule for stopping it.
Prevention:
a process is stopped by its own id,
or by the task id of the call that started it,
never by name or pattern;
the rules file every agent reads says so since.
`mistake-prevention.md`,
"Shell commands".

## M127: a message to resume read by an agent as a notice that it was cut short

Status:
happened on 2026-10-05 or 2026-10-06 (UTC),
the hour not established.
A usage limit stopped the lead,
the lead stopped five running agents,
and resumed them by message after the reset.
The message said the lead had stopped the agent for a usage limit.
The agent of the cluster of B282 read that as being cut short
and handed back a partial report with three of its five runners.
The lead sent it on,
and it handed back whole.
Prevention:
a message that resumes an agent says the limit is over and the whole task stands.
`mistake-prevention.md`,
"Tasks,
builds and bulk output".

## M136: agents' hand-back reports kept only in the session

Status:
happened on 2026-10-05 and 2026-10-06 (UTC);
nothing was lost.
Agents' final reports arrived as messages in the lead's session,
and the lead read them there without writing them to files.
Four were needed later,
for merges and for this batch,
and were extracted from the session's transcript
by the hand-back extraction script into the hand-back folder.
Prevention:
a hand-back is written to a file under the hand-back folder when it arrives,
before it is acted on.
`mistake-prevention.md`,
"Claims without their evidence".

## M137: agents' recurrences of recorded families, found in the lead's review of their patches

Status:
found 2026-10-06 (UTC) while merging the patches of B320 to B328;
each was changed before or in its merge,
and each change is named in its commit's message.

- Counts pinned in tests,
  against the owner's rule to avoid magic-number tests:
  the nesting differential pinned how many texts the scan passes (60,
  36 and 36),
  replaced in `d0aebf8a7` by the property that the passed texts are those its stated rule skips;
  the tag-name case pinned how many spellings the grammar accepts (106),
  replaced in `75ea14bff` by a check that both verdicts occur,
  and a check of a list's length against itself went with it;
  one more stands in a patch not merged at `3ce947dce`.
- A silent fallback (B21's seventh family):
  a regression count looked up by position with `?? 0`,
  paired by kind in `71702c550` (B323);
  more stand in a patch not merged at `3ce947dce`.
- Comments escaping their backticks,
  which a Markdown reader shows with the backslash:
  five lines in the deep-edit test,
  mended in `d0aebf8a7`.
  By the lead's probe of the comments the parser reports,
  twelve more comment lines in five older files stand so at `3ce947dce`.
- A generator whose comment claimed a coverage its code did not give,
  every suffix after every prefix,
  mended in `75ea14bff` (B327).
- A module comment naming two readers of a tag name where three existed,
  mended in `3ce947dce` (B326).
- Invisible characters written literally in test text,
  nine byte order marks,
  written as escapes in `75ea14bff` (M135).

Prevention:
the rules each family already has stand;
the lead's review reads every count a new case pins,
every `??` in a new line,
every comment that claims what code covers,
and every new file for invisible characters,
before the merge.
`mistake-prevention.md`,
"Guards that cannot fail",
"Defaults that stand in for an input",
"Claims without their evidence" and "Escapes and the layer that reads them".

## M142: a brief that handed on observations without naming their sources

Status:
happened on 2026-10-10 (UTC),
by the lead's notes for docs batch ten;
it touched no commit.
The lead's brief for the runner leftovers listed ten observations drawn from a task title and two old notes,
and three of them
(the fidelity request refusals,
the start time read first,
and the census over a suite with no pass)
had no source text in the notes at all,
so the agent had to find each again from the code and the ledger.
It did,
and all ten held (B379 to B389).

Prevention:
a brief that hands on an observation names its source
(a file and line,
a ledger code or a report)
or says it holds none,
so the agent knows whether it is checking a claim or searching for one.
`mistake-prevention.md`,
"Tasks,
builds and bulk output".

## M143: a census brief that said which silent arms become throws, and not which loud refusals stay

Status:
happened on 2026-10-10 (UTC),
by the lead's notes for the markup readers' cluster of the final census (T8);
caught at the merge,
before `40665630f2c096260d987736521970b828e89a0b`,
which it never reached.
The lead's brief for the final cold stretches carried the rule that a stretch answering without a word
for a state no input produces becomes an `unreachable:` throw.
It did not say that a loud refusal a caller already turns into a withheld result stays as it is.
The agent working the markup readers turned six `FootnoteRewriteError` refusals of the `position` kind
into plain `unreachable:` errors
(`runLeaves` twice,
`runEdges` three times
and `footnoteProtectedRanges` once,
in `footnote-unpositioned-runs.ts` and `footnote-protected-ranges.ts`).
The only production catch of that class is `relabelArchiveFootnotes` (`corpus-run/pass-footnote-relabel.ts`),
through `requireFootnoteRewriteRefusal`,
which keeps the archive unchanged and records the relabel as withheld,
while a plain error passes that catch and stops the entry,
by the lead's search of every caller.
So on a wrong proof the change would have stopped an entry where the run had shipped its archive,
against the owner's rule that a run always ships (`doc/design-commitments.md`).
The agent's proofs for the six rested on library sources,
and for one on mdast's phrasing content and a probe,
none on a refusal the libraries name.
The lead restored both files from the base at the merge,
leaving their six stretches cold,
and the choice stands for the owner under the T8 passage
"The markup readers' cluster of the final census".

Prevention:
a census brief names the refusal classes a caller handles,
and the callers that handle them,
so an agent can tell a handled refusal from an arm that answers without a word.
An agent's change of a handled refusal into a throw is the lead's decision,
made against the rule that a run always ships,
and is never merged on the agent's proof alone.
`mistake-prevention.md`,
"Guards a census wants gone".

## M145: a shared brief called a known defect of another package noise

Status:
happened on 2026-10-10 (UTC),
by the lead's notes for docs batch thirteen;
it touched no commit.
The shared brief of the follow-up round of B391 to B400 called the logger's sink verification lines noise,
not a failure.
The whole-suite census at `116bf6f4bba63f7375181dfddfef4e251eb10d34`
then showed such a line failing nine as-built cases,
each of which pins its child's whole stderr
(T9,
and the T8 passage "The runner and git cluster of the final census").
The advisor caught the label;
the lead corrected the brief and put the evidence on GitHub issue 573 of `module-logger`.

Prevention:
a brief names a known defect of another package as a defect,
with the cases it is known to fail,
and tells the agent to report such a case and run it again,
never to ignore it.
`mistake-prevention.md`,
"Tests touching the real world".

## M152: an agent worktree was created with the ignored-state copy the lead's own script avoids

Status:
happened on 2026-10-11 (UTC);
the two waiting worktrees were recreated within the hour.
`git worktree add` through the repository's Git wrapper copies the source worktree's ignored files;
the branch worktree's `node_modules/.monochromatic` held 888 MB of logger files,
and the copy held the settlement lock for over 45 minutes,
so two later worktree creations waited behind it.
The lead's scratch script for agent worktrees already passes `--no-worktree-copy`
and installs dependencies in seconds
(`doc/troubleshooting/cli-git-worktree-copy-install-stall.md` at the repository root names that flag as the workaround).
When the script was then run under `mise exec` from the scratch folder,
`git` resolved to plain Git,
which refuses the flag.
The same stretch chained four `&&` steps in one command against the limit of three.

Prevention:
agent worktrees are created with `--no-worktree-copy` from a shell whose `git` is the wrapper,
and only then set up by the script.
`mistake-prevention.md`,
"Shell commands".

## M155: an agent capped and chained shell commands against its brief

Status:
happened on 2026-10-12 (UTC) in the work of B437 to B440;
disclosed by the agent in its hand-back,
and no result it reported rests on the capped output.
The agent piped orientation and verification commands through `head`
and chained shell steps with `;`,
both of which its brief forbids.
Its final measurements (the named run,
the scans,
lint and the whole suite) were taken uncapped,
and the lead's own named run on the merged head confirmed them.

Prevention:
the brief's rules stand as written;
the lead reruns every count an agent hands back on the merged head before relying on it,
as here.
`mistake-prevention.md`,
"Shell commands".

## M157: two agents broke their briefs' edit and shell rules

Status:
happened on 2026-10-12 (UTC) in the work of B447 and B448;
disclosed by each agent in its hand-back,
and the lead's named run and gate on the merged head confirmed every result they reported.
The agent behind B447 edited three files through `python3` heredoc scripts and one `sed --in-place` deletion,
where its brief allowed the Edit tool only.
The agent behind B448 chained one shell call with `;`,
put more than three `&&` steps in four calls,
and used short flags where long ones exist.

Prevention:
the briefs' rules stand as written;
the lead reruns what an agent reports on the merged head before relying on it,
as here.
`mistake-prevention.md`,
"Shell commands".

## M158: two more agents broke their briefs' shell rules

Status:
happened on 2026-10-12 (UTC) in the work of B449 and B450 and in its review;
disclosed by each agent in its hand-back.
The agent that built the rebuild piped listings through `head`,
`cut`,
`sort`,
`sed` and `tr`,
chained calls with `;`,
ran two `for` loops and put `sleep` in a watcher script.
The reviewing agent used short `rg` flags,
put four steps in two calls,
and typed backslash-u escapes into a scratch script,
which then held invisible characters
(its edits to the package hold none,
checked with a positive control).
Gate g80 on the merged head confirmed the rebuild's reported results.

Prevention:
the briefs now name the display pipes they forbid one by one and give the long form of the flags agents reach for,
since a rule naming `head` alone left `cut` and `sed` open;
the lead reruns what an agent reports on the merged head before relying on it.
