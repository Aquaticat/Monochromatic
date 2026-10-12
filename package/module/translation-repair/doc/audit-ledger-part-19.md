# Audit ledger, part 19

Part 19 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B18: letter, digit and hex tests kept in many copies, and prose scanners that test ASCII letters only

Status:
fixed,
2026-09-28.
Letter tests were kept as named functions in eleven modules (`72bbe6500` merged them into `ascii-letters.ts`)
and inline in more (M48),
several named for Latin while testing ASCII only,
so an accented letter ends a word for every scanner that reads English prose with one.
The settled pages carry 4 such words in 17,492 (2 of 40 entries),
which is why nothing has visibly broken.
Done so far,
each with the same admitted characters as before unless stated:

- `9375057c5`:
  `latin-letters.ts` holds the Latin blocks and combining marks the glossary's form edges and
  the Canadian spelling pass each kept;
  the glossary edges now also admit Latin Extended Additional,
  of which only letters NFD keeps whole reach folded text,
  and none occurs in the pinned corpus or the settled pages
  (control U+00E4 found twice).
  The sheet hashes are unchanged,
  and mutants dropping the sign exclusion,
  the Additional block or the marks are each caught.
- `4197af843`:
  the inline letter-or-digit,
  digit and lower-case hex tests route through `ascii-letters.ts`;
  one of the digit tests (`image-reading-sense.ts`) was never called.
- `1c3286271`:
  eight source files opened with a blank line,
  each since its first commit.
- `8d88a08e1` and `f4aa85d9a`:
  the casing restore's `latinWords` opens a word on a Latin letter and continues
  through letters and combining marks,
  and takes the opening letter before its continue loop,
  which the mutation check showed could otherwise hang the pass (M50).
  Old against new (`~/temp/agent/audit-glossary-fix/letter-harness.mjs`):
  `latinWords` differs on exactly
  the 11 inputs the census names,
  `titleRuns` on 4.
  The page-assembly guard replayed old against new over 222 settled artifacts on their own slicing
  (`page-assembly-letter-replay.mjs`) differs on none;
  lowering the pass's `MIN_USES` makes it differ on one,
  so the replay can see this pass.
- `00a22f08e`:
  the name-casing pass's `midSentence` and glued-match check read Latin letters,
  digits and marks.
  A name after `café` now counts as mid-sentence,
  and an occurrence running on into `ō` or `ū` is another word;
  over the corpus `phraseOccurrences` drops one such false occurrence in each of 2 inputs,
  and no page changes.
- `218720cfe`:
  the address floor's word scan reads Latin letters;
  the pre-letter build refused a rendering
  addressing a cat named `Heřmánek` as if it said "he",
  and the current build accepts it.
  No finding changes over 131 source and target pairs;
  a control removing `you` makes 20 differ.
- `340b56ef5`:
  the suicide-method floor's word scan,
  the same;
  no finding changes,
  and a control breaking
  the suicide stem makes 21 differ.
- `3e28464fa`:
  those three scans were one scan in three copies;
  `latinWordSpans` and `lowerCaseLatinWords`
  in `latin-letters.ts` replace them,
  matching HEAD on every measure this entry records for the three.
  Mutants making the shared scan ASCII at the start or in the loop are caught by 6 assertions each.
- `bdc0112e6`:
  heading affinity's `latinTokens` come from the shared scan,
  folded by the new `foldLatinWord`
  (NFD,
  marks dropped,
  lower case),
  so a handle written with its accent composed,
  combining or left off
  scores against itself;
  `Kätzchen` no longer reads as `tzchen`.
  Token sets differ on the 13 inputs with such letters,
  and `prepareDocumentPair`'s slices on none of 92 pairs;
  with affinity disabled XingZ60's slicing moves,
  so the comparison sees this path.
- `ee99ee294`:
  the preservation gate's `contentTokens` run on Latin letters,
  digits and marks,
  and `properNouns`
  opens a name on any capital Latin letter (the new `isLatinCapital`),
  so a deleted `Émile` counts as a name lost.
  Token lists differ on 13 inputs and names on 9;
  `checkPreservation` replayed over 9,456 recorded repair regions
  (`preservation-replay.mjs`) changes no verdict,
  while raising the minimum name length flips 92.
- `a5ae23a8f`:
  the neutral-pronoun count no longer counts `TA` inside an accented word or before a combining mark.
  `sourcePronounLines` is unchanged on all 92 sources;
  counting occurrences inside words makes 31 differ.
- `23d2bea2a`:
  a missed quote's note counts accented words as one Latin token (diagnostic only).
- `fa0983503`:
  the picture-reading refusal screen reads accented words whole;
  the pre-letter build discarded a short reading of a `Noël` card as a refusal (`no` plus `l`),
  and the current build keeps it while real refusals still refuse.
  Word lists change on the 11 inputs with such letters;
  no recorded picture readings were replayed.
- `5f82122aa`:
  the quote and refusal tests add words opening on an accented letter,
  which closed mutants that tested only a word's first character against ASCII.
- `b4029fa3d`:
  content survival and the damage log read `foldedLatinWords`,
  so `château` is one specific of seven letters instead of `ch` and `teau`,
  both too short to count.
  Survival counts change on 6 of 131 archive-to-settled and archive-to-itself pairs,
  each by one accented word,
  and one settled page's lost list gains one such word.
- `435ba036f`:
  the lexical restoration grade (read by the recall benchmark only) folds accented words;
  word sets change on the 11 inputs with such letters and on no other.
- `c72cee0cf`:
  the line guard reads an accented-only line (`Å` beside its Han line) as the original's own English;
  the pre-letter build refuses that fixture's one-line rendering and the current build accepts it.
  `compareLineCounts` is unchanged on 131 pairs;
  forcing `isOwnEnglish` false makes 31 differ.
- `59e6f47c4`:
  the italic title restore reads a title opening on an accented capital (`Été des chats`).
  `archiveItalicSpans` is unchanged over 92 preparations;
  accepting any first character makes 18 differ.
- `94dca38d8` and `d107043be`:
  handle gloss placement reads word edges as Latin letters,
  digits and marks,
  where it had read any cased letter (so a kaomoji's Greek or Cyrillic letter joined a handle's word)
  and no combining mark (so a gloss could land between a letter and its accent).
  Page assembly replayed over 222 settled artifacts changes nothing;
  with the edge test always true,
  7 differ.
  The first commit's test never reached the path it named (M53);
  the second puts the accented word where
  the pre-letter build does insert the gloss before the accent.
- `d8a90d528`:
  a handle's reading keeps a space from an accented word beside it (`YumaoÉmile` no longer).
  `nameAuthorities` is unchanged over 92 preparations;
  tagging every romanised run changes one signer rendering.
- `81f2ce048`:
  a ballot finding naming a longer accented word (`tabbyé`,
  or a combining accent) blames no candidate;
  the wire reads model replies,
  so no corpus replay applies,
  and the test pins both spellings.
- `b44711b68`:
  block alignment tokens are folded Latin word and digit runs instead of ASCII runs by code point.
  Token sets change on 13 inputs,
  and `prepareDocumentPair`'s slices on none of 92 pairs;
  with tokens disabled the slicing of 10 pairs moves.
- `baed88f59`:
  tests written negated (`(character < '0') || (character > '9')`) route through `ascii-letters.ts`:
  four whole-text digit tests become `isAsciiDigits` and a lower-case letter test `isAsciiLowerLetter`,
  each admitting the same characters as before,
  the empty text included.
  The full suite after it:
  0 FAIL,
  1,303 PASS.
- `16bd8c142`:
  the apostrophe and nested quotation readings read the combining character sequence before a straight quote
  (`sequenceBefore` in `quote-neighbours.ts`),
  and `bindsWord` tests its base,
  so `café's` written with a combining acute curls as its composed spelling does,
  and no longer counts as an opening quote that kept a later trailing apostrophe straight.
  The whole sequence is kept for the other tests,
  so a mark on a space (a standalone accent) is still no space a quotation opens after;
  a first version that read the base alone curled that case,
  and the build before the change leaves it straight.
  No straight quote follows a mark in the sources or the archive's English;
  in 372,489 distinct artifact strings 5 do,
  each a variation selector on a heart in judge prose,
  where both readings agree.
  Page assembly replayed over 222 settled artifacts changes nothing;
  a control tree whose `bindsWord` never binds makes 62 differ.
  `restoreTypography` also runs inside the repair and refine stages,
  so the pre-launch cache check (M28) reads this commit.
- `a7b08bbfc`:
  the Canadian date and spelling passes read a word written with a combining accent whole.
  `isWordCharacter` (a cased letter or a combining mark) moved to `canadian-date-parts.ts`;
  `continuesWord` and every word run read it,
  the initial test counts letters with marks left out,
  and an underscore's or dot's far side reads a mark as the word it ends before the word,
  and as no word after it.
  Before the fix,
  `4 May` with a combining acute after it became `May 4` with the accent on the digit,
  and an initial,
  a heading's small word,
  a May compound and an identifier each read differently from their composed spellings.
  No combining mark occurs in the sources or the archive's English,
  and in run artifacts only 3,
  all in judge ballot reasons the passes never read
  (control:
  the same census over composed Latin letters finds 2,972),
  so no page changes.
  Mutants:
  8 of 9 caught;
  the month-run and range-word switches are equivalent
  (a mark at a month's end is refused by `continuesWord`,
  and a range word needs a space after it)
  and are kept so every word run reads whole words.

The package now tests for a combining mark in two ways,
on purpose:
`isCombiningMark` (`latin-letters.ts`) takes the Combining Diacritical Marks block,
U+0300 to U+036F,
the marks NFD splits off Latin letters,
for scanners that read Latin words;
`MARK_CODE_POINT` (`quote-neighbours.ts`) takes general category M,
variation selectors included,
because a quote's neighbour can be any character a mark sits on,
an emoji among them.

The census bounds every switch:
the characters an ASCII test and a Latin letter-or-mark test disagree on
occur in 2 of 92 sources (7 characters),
9 of 92 archive pages (20) and 2 of 40 settled pages (4).

The last copies were three `opensTag` tests,
one per scanner that reads markup:
- `7a46c8be8`:
  the typography mask took ASCII letters and `/`,
  the markup atom scan the same and `!`,
  and the prose ranges `/` and any cased letter.
  `mdx-tag-start.ts` now answers for all three as `micromark-extension-mdx-jsx` 3.0.2 does
  (`dev/lib/factory-tag.js`,
  `startAfter` and `nameBefore`):
  a space,
  tab or line end after `<` leaves it text,
  other whitespace is stepped over,
  and `/`,
  `>` or an identifier start (`$`,
  `_` or Unicode ID_Start,
  Han included) opens a tag;
  anything else fails the compile.
  The atom scan names `<!--` explicitly,
  which the corpus build rewrites into a JSX comment.
  Before the fix a tag named in Han,
  or opening on `_` or `$`,
  or after a no-break space,
  was prose to all three,
  so its quoted attributes were curled (which compiles nowhere) and respelled.
  The new test checks 19 probes against the package's own MDX parser.
  Over the sources,
  the archive's English,
  the settled pages and 372,489 artifact strings,
  what follows `<` is an ASCII letter,
  `/`,
  `<!--`,
  markdown whitespace,
  or `|`,
  `]` and `@`,
  on all of which every version agrees.
  Page assembly replayed over 222 settled artifacts against the tree before the change differs on none;
  a control tree whose test never opens a tag makes 38 differ and 96 fail the guard.

What remains tests letters in any script on purpose:
`isCasedLetter` in the Canadian passes
(a Cyrillic letter glued to a listed word makes a longer token),
their capital tests,
the quote neighbours' general categories,
and `declared-name-survival.ts`'s letters and numbers after NFC
(handles are written in Han).
A last shape census over non-test source,
asserted and negated forms,
character-code ranges,
case-fold comparisons and regex classes,
finds nothing else outside `ascii-letters.ts` and `latin-letters.ts`,
and no regex uses `\w` or `\b`,
which are ASCII-only in JavaScript
(control:
the same search finds the `\s` in `mdx-tag-start.ts`).

### B19: copies inside one file, which the cross-file census never showed, and no guard against a new copy

Status:
fixed,
2026-09-28.
The census behind B1 to B15 grouped bodies kept in two or more files,
so a body kept twice in one file never showed.
Widened to any two places,
it found three more beside B15's frozen pairs:
- `f72d96d18`:
  `rendering-audit-settled-repeat.ts` built a repeat pair twice (now `repeatPairOf`);
  `artifact-two-lane-read-evidence.ts` read each lane's slice texts twice (now `requireEvidenceRows`;
  both parsers read one artifact version,
  so they may share);
  and `slice-cache-store.ts` kept `isCachedPairing` and `isCachedSectionPairing`,
  one check under two type guards (now `isCachedPairingRecord`).
  Both copies of that check tested only that findings were a list,
  where both record types promise text,
  so a record with a non-text finding is no longer resumed.
  The pairing caches are exported for a new test (`slice-cache-pairing.unit.test.ts`),
  which round-trips a record through each and refuses a numeric finding,
  a non-index pair (`23ce27694`) and a bare list;
  mutants restoring the list-only finding check or dropping the pair check are each caught by 2 assertions,
  and the control survives.
- `4e79127ad`:
  `duplicate-bodies.unit.test.ts` parses every non-test source file with rolldown's parser
  (`parseSync` from `rolldown/utils`,
  as the repository's import-attributes plugin reads source;
  TypeScript 7 exposes no stable compiler API),
  compares each function body with its comments cut out and whitespace dropped,
  and fails on a body of 80 or more such characters kept in two places,
  except B15's frozen copies,
  listed with their reasons;
  a listed copy that no longer stands fails it too.
  Its fixtures first show the scan finds a copy across files whatever the comments and layout,
  and a copy inside one file,
  and leaves bodies differing in one name and short ones.
  A mutant restoring one merged copy and a mutant drifting a frozen copy are each caught;
  a comment control survives.
  `rolldown` joined the package's devDependencies from the catalog,
  and the lockfile gained that importer entry only.

The other cache readers (`slice-cache-store.ts`,
`consolidate-cache-store.ts`,
`lane-contest-cache-store.ts`,
`reading-cache-store.ts`) check that a record's fields are present and its lists are lists,
not every element.
That was read as deliberate rather than a defect:
each lane cache is opened with the built pipeline's digest as its generation
(`pass-entry-caches.ts`,
`pass-prepare.ts`,
`pass-consolidate.ts`),
and a namespace whose generation moves is deleted (`slice-cache-namespace.ts`),
so a file these readers accept was written by the same built code from values of these types;
the shape checks are the belt the module comment names beside that brace.
The lookup cache,
which outlives builds,
already checks every hit (`isLookupRecord`).

### B20: functions nothing calls, and no check that reports one

Status:
fixed,
2026-09-28.
A census of every top-level function in the package's non-test source
(`.cache/dead-functions.mjs` in the package,
rolldown's parser)
found one private function its file never names beyond its declaration
and one export no other file names;
a control copy of the source with one planted function of each kind reported both.
- `cb30e516e`:
  `isAnchored` (`coverage-verdict.ts`) had been the evidence filter until `d6db46519` made full-coverage votes the only evidence,
  and `uniqueRosterModelIds` (`consolidation-naturalness-state.ts`) served the naturalness correction loop `0f1898942` removed;
  both are gone,
  with the import only the second read.
- `549f15bbd`:
  `dead-functions.unit.test.ts` fails on either kind,
  counting a test as naming an export;
  its fixtures first show it finds each kind and leaves a function called in its file,
  named in another source file or a test,
  or exported by a list.
  Writing the fixtures caught a flaw in its own whole-word check
  (the last occurrence read no following character,
  so a longer word counted),
  pinned before the package-wide case could pass on it.
  Both source guards now read through `source-scan.test-fixture.ts`.
  Mutants planting a dead private function,
  a dead export,
  and restoring a merged copy are each caught;
  a comment control survives.

### B21: the other recurring families have no recorded code-reading pass

Status:
fixed,
2026-09-29,
recorded the same day so the work outlived the session's task list;
every family is read and fixed:
family one (text indexed by UTF-16 unit) as B22,
family two (matches without word boundaries) as B23,
family three (straight against curly quotes) as B24,
family four (trimmed text compared with raw text) as B26,
family five (quorum denominators counting unreachable seats) as B27,
family six (sheets missing blocks) as B28,
and family seven (silent fallbacks) as B29,
which names the one gap it leaves open under its own heading.
B1 to B20 came from the duplicate-body and letter-predicate censuses.
The class history names other families that recurred across stages,
and this ledger records no code-reading pass over them:
text indexed by UTF-16 unit (class ninety-six),
substring or prefix matches without word boundaries
(class one hundred sixty-three;
area one fixed the glossary's matcher,
and no pass over the other sites is recorded),
straight against curly quotes
(classes thirty-eight,
seventy,
one hundred sixty-eight and one hundred seventy-five),
trimmed text compared with raw text
(classes sixty-five and one hundred one),
quorum denominators that count unreachable seats
(classes twenty-six and fifty),
sheets missing blocks,
and silent fallbacks.
Fix:
read each family's sites across translate,
repair,
consolidation,
the provider clients and the corpus-run driver;
each finding gets its file and line and a probe that reproduces it,
and is fixed with a guard shown failing first.

### B22: text read by UTF-16 unit where the test reaches past the first plane (B21, family one)

Status:
fixed,
2026-09-29.
Class ninety-six read a quote's neighbour one UTF-16 unit at a time,
so the low half of a script letter was no letter.
The pass over the family read every test whose domain reaches past the first plane
(the Han blocks from Extension B on,
`\p{L}`,
case)
and every scan that feeds one:

- Declared names.
  `nameProjection` (`declared-name-survival.ts`) scanned by unit,
  so a handle in mathematical script projected to nothing
  and one holding an Extension B ideograph fell under the shortest checkable form;
  neither was ever checked.
  Before the fix,
  no declared name or contributor form at the pin held a letter beyond the first plane,
  and over 835 form and text pairs from the 92 archives and 214 settled pages
  no survival answer changed,
  where a script letter planted inside a form's occurrence did.
  Red `409114af6`,
  fix `6346909fc`;
  a mutant restoring the unit scan is caught.
- The preservation tokenizer.
  `contentTokens` (`preservation-tokens.ts`) read `text[index]`,
  so the gate never saw an Extension B ideograph,
  although audit area six widened the Han test to every block (`han-only-text.ts`).
  `348e97c58` moved `codePointAt` and `codePointBefore` from `quote-neighbours.ts` into `code-points.ts`
  and dropped the private copy in `mdx-tag-start.ts`;
  red `328a35e6e`,
  fix `9816ae18a`.
- The Han residue floor.
  `translate-han-residue.ts` built its runs from single units,
  so such an ideograph left alone in prose passed,
  and a run it opened was named from its second character.
  Red `08f797e48`,
  fix `fdaf1752a`.
- The Canadian and pinyin page passes.
  `runEnd`,
  `runStart` and 19 other character reads in the date,
  spelling and capital readers took one unit,
  so a date or listed word glued to a Deseret letter was rewritten
  where one glued to a Latin letter is not.
  The pinyin pass never took an Extension B ideograph for Han,
  and its comment that every ideograph pinyin-pro reads is one unit was false:
  pinyin-pro 3.29.3 gives a reading for 196 of the 65,312 code points in Extensions B to H
  (`~/temp/agent/audit-glossary-fix/b21-pinyin-astral.mjs`).
  Red `4b4066c86`,
  fix `73e158c8b`;
  `52fe27efd` adds one Latin-twin case per converted read,
  and a unit read restored at any of them breaks the comparison,
  except the date cursor,
  where no month name starts beyond the first plane,
  so the whole letter opens no month either;
  that mutant is equivalent.
- Two readings of a cased letter.
  `quote-neighbours.ts` read one by general category
  (class ninety-six:
  script letters are cased letters with no case mapping),
  the Canadian passes by case mapping,
  so a script letter bound an apostrophe but was no letter beside a date,
  and the capital and small-letter tests read a script capital as neither.
  `cased-letters.ts` holds one reading for both;
  red `9369541f4`,
  fix `f94718959`.
  Over 306 pages,
  settled and archived,
  the Canadian pass wrote the same text under either reading,
  and a control page glued to a script letter differed.
- Text excerpts.
  Eleven limits at thirteen cuts
  (an error body excerpt,
  a stream opening,
  a refused reading,
  a raw reply preview,
  bench and probe failure details,
  a ledger report,
  a tally line,
  a rendering-audit drop reason and a blockquote note)
  could keep half an emoji in a log line or a persisted run row.
  `wholeOpening` (`code-points.ts`) cuts on a whole character;
  red `95c13f282`,
  fix `9830a6a4c`.
  `fixed-length-cuts.unit.test.ts` lists every other `.slice(0, LIMIT)` and `.slice(-LIMIT)` with its reason,
  so a new fixed-length cut is classed before it lands.
  `NOTE_WORDS` counted units and is `NOTE_OPENING_UNITS`.
- The shared readers themselves.
  `code-points.ts` and `cased-letters.ts` shipped tested only through their callers;
  the text barrel now exports both,
  and each has its own unit test.
  Those tests found two faults with a lone surrogate:
  `codePointCount` counted every unit that is not a second half,
  so a lone second half counted as nothing,
  and `wholeOpening` dropped a lone first half that no pair followed.
  Both now read a lone half as one character,
  as the string's own iteration does.
  Red `a6193fc8f`,
  fix `f6e93ed5f`;
  9 mutants are caught,
  and a comment control survives.
  `lone-surrogate-census.mjs` finds no lone surrogate in the pinned corpus
  or in any string of the 265 stored artifacts,
  while its control finds both kinds.

Read and left as they stand:
`translate-neutral-pronoun.ts` compared one unit with U+2E80,
and a surrogate half compares above it as its whole code point would
(B23 has since replaced that comparison with `tokenStarts`);
the recurrence watcher's tails are compared unit for unit with the buffer they came from;
the refusal windows are searched for markers a cut character cannot match;
and `latin-letters.ts`,
the ASCII tests and the handle scans test first-plane blocks only,
where a unit read answers as a code-point read does.

Exposure at the pin:
the pinned sources and archives,
the settled pages and the 370 stored artifacts hold no Han,
kana-supplement or case-mapped letter beyond the first plane;
what lies beyond it is bold script
(328 letters on pages,
12,390 in artifacts)
and emoji,
which every site this entry lists reads the same either way,
the cased-letter reading aside,
measured under "Two readings of a cased letter".
The translate,
consolidation,
contest,
refine and repair versions carry rides-inside accounts;
the page passes and the excerpts key no cache.
Prevention:
`mistake-prevention.md`,
"Text by code point".
