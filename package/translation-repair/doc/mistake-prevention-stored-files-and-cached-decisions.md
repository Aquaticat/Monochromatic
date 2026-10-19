# Preventing mistakes: stored files and cached decisions

Rules for what one run stores and a later run reads back:
caches and their versions,
stored files,
and file names derived from an input.

Part of [Preventing this package's mistakes](mistake-prevention.md),
which lists every file of this record.

## Cached decisions

What happened:
floors,
sheets and quorums changed what a cached stage asks or accepts,
and no cache version moved (M25);
the correction then checked three of six versions (M28);
a key gained a field from a flag's name,
not from what the field changes (M37).
The tense-candidate change (ledger B419) moved no version,
since every affected stage's run shape names the recorded death and the subject names,
so its key moves for exactly the entries whose question changed;
the three pinned-key witnesses were read first,
and kept their pinned strings for an entry that records no death.

The rule:
a commit changing a floor,
a sheet,
a threshold or a settlement rule in a cached stage
names in its message the version it moves,
or why none moves.
A field enters a key only when a run that goes ahead reads it into a question or a weighting.
Keys hash one JSON value of fixed shape with the version in it (X15),
never joined strings.

What enforces it:
the key-shape tests (`block-pairing-question-key.unit.test.ts`,
`pass-page-titles.unit.test.ts`)
fail when a key drops its version;
the checklist's cache step covers the rest,
through the `cache-account-audit` task,
which reads the constants out of the source rather than from a remembered list,
and whose readers are pinned by `cache-account-read.unit.test.ts` and `cache-account-commits.unit.test.ts`.

## Files a later run reads back

What happened:
the lookup cache and the reference cache parsed their files with no catch,
read every read failure as "no file",
and wrote in place.
A lookup file cut short took its title's evidence away on every later run,
since the caller caught the parser's error as a failed lookup and nothing rewrote the file;
a reference file cut short failed the entry citing its page on every run;
and a directory standing at a record's path had the record bought on every run and never kept
(ledger B134,
B135).
A lane's generation marker was rewritten in place on every open,
also when it already named the running generation,
and a write the disk refused would have left it empty,
so the next open discarded the lane's paid slices (ledger B136).
The same audit found the window trial ledger joining a resumed run's first row onto a torn last line,
and three coverage census readers whose `@throws` promise their own class
running `JSON.parse` bare (ledger B135,
open).

The window trial ledger was mended:
an append ends a torn last line first,
and a line that ends in a newline and does not parse is refused by name (ledger B152);
a whole line of an older row shape is left out and counted,
not dropped without a word (ledger B153).

The audit's open items were closed:
three coverage census readers now refuse a file that is not JSON by their own class (ledger B163);
a failed atomic write removes its temporary file,
and the temporary name is unique to the call,
since two writes of one path in one process had shared one (ledger B164);
and the runs lock is claimed by linking a file that already holds its text,
since a second starter read the lock empty between its create and its write
and took it over from a live holder (ledger B165).
A temporary name is unique to its call,
not to its process,
and a lock another process may read as abandoned appears with its content already in it.

A cached block pairing was checked for its shape alone and used as stored,
while three comments said a reader read it again,
so a record naming a block its section lacks ended the run with a missing-value error naming nothing (ledger B171).
A record read back is read against what it is about to be used on,
by the check a fresh answer goes through,
and one that does not fit is a miss said on a warning.
The check B171 added read a cached block pairing's indices alone,
and a cached section pairing was still handed on unread,
so a record that moves backwards,
repeats a correspondence or pairs one section twice reached the aligner and the slicer (ledger B218).
The check a fresh answer goes through is its whole reader,
not that reader's first test.

A command read a file its operator names with a bare read,
so a path that is not there raised the read's own error (ledger B183).
A command refuses an unreadable input file by name,
before it spends a suite on it.

A final draw wrote an empty gate sheet that an exclusive create then protected for ever;
a failed draw removed a sheet another draw had made,
since its tracker recorded a path before the write;
and an empty pool left a kept,
empty sheet and manifest (ledger B297).
A write that nothing may replace is made only once there is something to write,
and a cleanup removes only what its own run created.

A settled run file's rows were checked as a list and then cast,
so a row that was no object passed into every later reading,
keyed as `undefined` or ending one in a type error (ledger B313).
A file's elements are checked where the file is read,
not only its outer shape.

The first draft of the tense-candidate record let the contest reader accept `tenseCandidates` from generation 14,
while the generation 15 `sole-lane` path returned before the key was read,
and its writer wrote the key on every slice,
so a sole-lane record would have been read with the key dropped (ledger B419).
A key a reader accepts on one path of its function is read on every path that accepts it,
or refused on the paths that do not read it,
and the writer writes it only where the reader reads it.

The tense review found the same reader taking an empty list and any label the writer never writes
(ledger B433),
and a replay reading `info.yml` for a generation whose run never read it.
Two pieces of work that both changed what generation 15 holds were merged onto one head,
and five test fixtures of one built that generation by hand without the other's section,
or restamped it as 14 with the section still in it (ledger M153).
A reader accepts only what its writer writes,
and a replay reads an input only for the generations whose run read it.
When two pieces of work change one record generation,
the second merge runs every test that writes that generation by hand,
and a fixture restamps a generation through `generation-restamp.test-fixture.ts`.

The rule:
a file this package writes and a later run parses is written through `writeFileAtomic`.
Its reader tells a path nothing stands at from a file that is there,
takes a parse failure as data and says so,
naming the file and never its text,
since V8's refusal can quote the text it refused,
and raises a named error for a file that is there and cannot be read,
since a miss would buy the record again and then meet the same path at the write.
A reader that must refuse a damaged file says so in its doc and names the file in its message.
An append-only ledger that tolerates a torn last line repairs it before it appends again.
A file that vouches for paid work,
such as a generation marker,
is rewritten only when what it says has changed,
and then atomically.

What enforces it:
`lookup-cache.unit.test.ts` and `reference-cache.unit.test.ts` hold a file cut short,
an empty file,
JSON of another shape,
an absent file and a directory at the path;
`slice-cache-namespace.unit.test.ts` holds the restamp by replacement and the reopen that writes nothing.
No scan holds every `JSON.parse` of a file to a catch or a failure-as-data helper,
nor every plain `writeFile` to a reviewed list;
until one does,
a new reader or writer of such a file is reviewed against this rule.

## File names derived from an input

What happened:
the OCR reader copied a picture to `asset.` plus its extension
and decoded it to `asset.png`,
so a `.png` asset was decoded onto itself,
and a first decoder that wrote part of its output before failing left the fallback to decode that (ledger B147);
the same extension,
taken as the whole text after the name's last dot,
let `../../etc/passwd` point the write outside the scratch directory,
and a 300-letter extension fail the write (ledger B148).

The rule:
every file name a function derives from an input is checked against every fixed name the same function writes,
and a fixed name is chosen outside the set the derived one can take;
a part of a name taken from an input is limited to characters and a length that cannot leave the directory
or fail the write.

What enforces it:
`image-ocr.unit.test.ts` holds a `.png` picture whose first decoder damages its target,
and asset names with a traversal,
a space and a 300-letter extension.
No scan finds a derived name beside a fixed one;
a new writer of scratch files is reviewed against this rule.
