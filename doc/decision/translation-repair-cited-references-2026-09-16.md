# Translation repair: the critic and panel sheets read the pages the original cites

## Status

Decided by the owner on 2026-09-16 and landed in `dff8c91d2` (class thirty-five).
The owner's words,
answering the four options put to them:
"3,
and we have Exa.
Such Exa fetched results need to be cached too to avoid hitting reference links too much."
And,
while the fix was being built:
"Cache Exa results semi-permanently on disk since the reference links rarely change their content."

## What was found

The Mio19 page (2026-09-16,
the pass log's "Mio19 read" heading) lost the archive's clause
"older sister who is also trans".
The Chinese page says only 有一个姐姐,
in every one of its seven revisions.
The blog the page cites,
`stblog.penclub.club/posts/InMemoryOfMio/`,
says 「Mio 的姐姐也是 MtF。她大我们八岁，在小学五年级时就第一次穿了女装」,
and the translation commit `c7cc3259` was written by someone who had talked to the sister.
Four critics filed the clause as `accuracy/addition` with the summary that it is
"not present in the source text";
the panel supported all four;
the editor deleted it.

Both sheets already said not to.
The critic sheet (`critic-prompt.ts`) reads
"ACCURATE detail a translator added is not an addition defect ...
Report such detail ONLY when it is WRONG",
and the adjudication sheet (`adjudicate-prompt.ts`) reads
"Vote unsupported on a claim whose whole case is that the ORIGINAL does not carry it;
vote supported only when the added detail is WRONG."
Neither rule had a mechanism,
and neither held.

Measured over the repair lane's shipped edits
(`lanes.repair.result.issues` in each run's artifact,
category `accuracy/addition`,
disposition `shipped`):

- Mio19 filed 24 addition claims and shipped 20 edits from them.
- Mio16 filed 24 and shipped 14.
- Mio12 filed 22 and shipped 9.
- hakureico23 filed 12 and shipped 11.
- noname3 filed 9 and shipped 7.

Among Mio19's twenty:
the sister,
the backpacks in `photo5`,
"no one was hurt",
"in mainland China",
"lucky",
the closing farewell.
Some deletions are right by any reading
("two days after the accident" contradicts the source's own date);
others are knowledge the human translator had and the Chinese page never wrote down.

## The options put to the owner

Ranked A > C > D > B.

- A.
  Only what the source contradicts:
  an addition claim against archive text must quote the original statement it conflicts with;
  absence alone is refused before adjudication.
  Pro:
  honours the translator's knowledge,
  matches both prompts,
  deterministic.
  Con:
  translator embellishments stand too.
- C.
  Facts stand,
  wording may go:
  a contradiction required only for clause-sized claims.
  Con:
  the fact-versus-wording line is drawn by the judges.
- D.
  Feed the cited reference to the critics.
  Pro:
  the sister case resolves on evidence.
  Con:
  external fetches,
  only entries that cite,
  no help for facts from pictures or private contact.
- B.
  Keep source-only authority.
  Con:
  keeps deleting true facts against both prompts.

The owner chose D,
with the cache.

## The mechanism

- `cited-reference-scan.ts`:
  every `http://` or `https://` link the original writes,
  once each,
  in order of citation,
  trailing sentence punctuation removed,
  at most eight.
  Left out:
  the corpus's own site,
  and people's profiles
  (a one-segment path on github,
  twitter,
  x or t.me;
  any `space.bilibili.com` page;
  `zhihu.com/people/`),
  because the Mio probe returned a GitHub user page as repository names and a bilibili space as page chrome.
  Measured over the pinned corpus:
  59 of 92 originals link somewhere,
  116 links,
  twitter 45 and github 22 the commonest hosts.
- `cited-reference-fetch.ts`:
  `POST https://api.exa.ai/contents` with `urls` and `text.maxCharacters` 4,000,
  raw `fetch`,
  the key from `TRANSLATION_REPAIR_EXA_API_KEY` in the `x-api-key` header and never logged;
  `results[0].title` and `text`,
  `statuses[0].error.tag` on failure.
- `reference-cache.ts`:
  one JSON record per url,
  named by the url's digest,
  under `~/.cache/translation-repair/lookup/reference/`
  (the `TRANSLATION_REPAIR_LOOKUP_CACHE_DIR` override carries over).
  Never expires;
  a failure is cached too,
  so a dead link is not hit on every pass.
  To refresh one page,
  delete its file.
- `cited-reference-lookup.ts`:
  one line per page,
  `- reference N <url> ("<title>"): <text on one line>`,
  or `could not be fetched (<tag>)`,
  joined into `referenceContext` on the prepared pair.
  The log prints `REFERENCE N <url>: success, <chars> chars, cached|bought` and
  `REFERENCES cited=N cached=K bought=M`.
- `cited-reference-rule.ts`:
  the block `CITED REFERENCES, EVIDENCE ONLY` with the rule:
  a detail the translation carries that the original does not state but a cited reference states
  is accurate detail the translator took from the original's own references,
  never an addition;
  the references never license adding,
  never outrank the original,
  never license a defect elsewhere.
  The critic sheet carries it after the pair,
  the panel sheet after the claims.
- `repair-slice-key.ts`:
  the block joins the run shape only where the original links somewhere,
  so the 33 entries that cite nothing keep the keys their slices were settled under.

The threading is `referenceContext?: string` from `pass-prepare.ts`
through `prepareDocumentPair` and the prepared pair into `repairChunk`,
the critic phase,
`runCriticStage` and `runPanelStage`.
It is a field of its own,
not a line of the identity context,
because the identity block's rule says it is evidence about naming only
and the refiner reads that block as names that must survive exactly.

## Verified

- Live on 2026-09-16 with the Mio source:
  the blog came back with 姐姐也是 in its 4,000 characters,
  its archived copy timed out (`CRAWL_LIVECRAWL_TIMEOUT`,
  cached as such),
  the two profile pages came back as chrome and are now excluded.
  Four records in the cache;
  a second ask bought nothing.
- Guards shown to fail:
  with the block disabled,
  `critic-prompt.unit.test.ts`,
  `adjudicate-prompt.unit.test.ts` and `cited-reference.unit.test.ts` fail,
  and pass restored.
- Mio20 (frozen `dff8c91d2`) is the first pass on it;
  the reading is whether the sister clause ships and how many addition claims shipped against Mio19's twenty.

## Mio20 and class thirty-six

Mio20 (frozen `dff8c91d2`,
2026-09-16 18:44 UTC) showed the mechanism working where it was placed and failing one stage later.
The panel rejected the three addition claims on the sister clause 3 to 2
(Mio19:
supported 4 to 1),
addition claims accepted fell from 30 of 36 to 11 of 21,
and the repair lane's slice kept `who is also trans`.
Then the lane contest,
shown only the original,
had three of five judges call the repair candidate unsupported for the clause,
the translate lane won the slice,
and the consolidation wrote from it.
`20a7272dc` (class thirty-six) threads `referenceContext` into the lane contest sheet,
the consolidation writer and gate sheets and the translate judge
(which judges consolidation slates too),
with `CITED_REFERENCE_CANDIDATE_RULE`:
a detail the archive rendering or a candidate carries that a cited page states
is never counted unsupported and never a reason to prefer the rendering that drops it.
The three run shapes fold it in only when non-empty.
Mio21 is the first pass on it.

## Mio21, class thirty-seven and class thirty-eight

Mio21 (frozen `20a7272dc`,
2026-09-16 20:40 UTC) showed the prose rule losing to the sheets' own addition category.
The references were on every sheet and the judges' replies cite them,
four select judges writing that the sister's trans identity is
"true per the cited reference but is NOT stated in the ORIGINAL passage,
so it is an addition";
the panel supported the addition claim 3 to 2
(Mio20 rejected it 3 to 2),
the repair lane dropped the clause,
and the page kept it only because slice 2's slate was declined and the archive stood.
`35e9a0785` and `887e5262c` (class thirty-seven) make the reading mechanical where it can be:
at preparation the bench answers one focused question,
which archive details absent from the original a reference states,
each as a verbatim archive quote plus a verbatim reference quote,
both checked as substrings with whitespace removed;
details at least half the heard voices gave become `- attested:` lines under the references on every sheet,
and an `accuracy/addition` claim whose quote overlaps one is rejected before the panel.
The archive block review's revision of the first chat block shipped straight quotes into a curly page;
`6b853e5ce` (class thirty-eight) restores the archive's quote style on every revision candidate.
Mio22 (frozen `35e9a0785`) attested nothing because one of three sister attestations
wrote the reference's Chinese with spaces around its Latin tokens;
the whitespace fix landed and Mio23 is the first pass on it.

## Cost

Exa bills per page read;
the response carries `costDollars` and the four Mio pages were bought once.
The sheet cost is prompt tokens:
at most eight references of 4,000 characters on every critic and panel call of an entry that cites,
placed after the pair so the cached prefix on OpenRouter still applies.

## Rejected

- A mechanical contradiction requirement (option A):
  the owner preferred evidence over a rule.
- Highlights instead of page text:
  the question the critics ask is not known when the page is bought.
- Fetching at adjudication only:
  a critic that reads the reference files fewer claims,
  and every claim it does not file saves a panel and an editor round.
