# Git 2.55.0 line origins do not identify semantic archive revisions

## Symptom

Archive evidence needs a verified before/after change at a current occurrence.
`git blame` supplies line origin metadata,
not a semantic classification of the edit or the deleted text.
Treating every origin as a naming declaration would mislabel punctuation and ordinary wording changes.
This is a consumer interpretation problem,
not an error emitted by Git.

## Source trace

The source reference is Git tag `v2.55.0`,
commit `e9019fcafe0040228b8631c30f97ae1adb61bcdc`,
read without modification in `~/temp/agent/git-reference-20260910`.
Paths in this section are relative to that Git source tree.

`builtin/blame.c:359` enters `emit_porcelain`.
Its header reports the origin object and original/final line coordinates:

```c
/* builtin/blame.c */
oid_to_hex_r(hex, &suspect->commit->object.oid);
printf("%s %d %d %d\n",
       hex,
       ent->s_lno + 1,
       ent->lno + 1,
       ent->num_lines);
```

The same function reads the current final buffer,
not a deleted predecessor line:

```c
/* builtin/blame.c */
cp = blame_nth_line(sb, ent->lno);
```

`builtin/blame.c:233`,
`write_filename_info`,
prints the origin path through Git's quoted-path writer:

```c
/* builtin/blame.c */
printf("filename ");
write_name_quoted(suspect->path, stdout, '\n');
```

A consumer must therefore preserve path provenance and handle quoted filenames,
not assume every origin has the requested current path.
`Documentation/git-blame.adoc`,
“Description,”
also documents automatic whole-file rename following
and states that deleted or replaced lines require diff or pickaxe information.

`builtin/blame.c:365` selects repeated metadata when `OUTPUT_LINE_PORCELAIN` is set;
`Documentation/blame-options.adoc` documents `--line-porcelain`
and the empty `--ignore-revs-file` value that clears configured ignore files.
The inspected prototype uses that explicit clearing rather than letting an operator's ignore list change its provenance.

`Documentation/diff-options.adoc`,
“`--diff-merges`,”
defines `first-parent` as the ordinary full diff against the first parent.
The prototype uses that format explicitly,
along with zero context,
so it does not parse combined merge hunks as ordinary single-parent replacements.

## Verification

The installed native binary reports Git 2.55.0.
The repository PATH also contains a policy shim;
`package/module/translation-repair/src/corpus-run/git-command.ts`
already provides `resolveGit` for the native-binary preference.
No alternative resolution policy is proposed.

The read-only harness is:

```text
# Run from the translation-repair worktree.
node ~/temp/agent/prototype-archive-revision-acquisition-20260910.mjs
```

It defaults to the pinned corpus and `people/Mio/page.en.md`.
Arguments can supply repository,
commit,
path and output file.
Results are recorded in `~/temp/agent/archive-revision-acquisition-20260910.json`.

The measured invocation reads 234 lines,
considers nine origin revisions,
and makes eleven Git calls returning 131374 bytes.
It derives forty-two single-line replacement records,
including the naming change from `春の芽工作室` to `Harunome Hanbai`
at origin `33a9d3d9995a985f0df67f877a61e0238c0769a3`.
The algorithm does not name that origin in advance.

### Cases that produce verified records

- A one-line replacement whose added line matches the current blamed line.
- An ordinary wording replacement under the same exact-line check.
- Punctuation changes,
  which are valid revision records but are not naming declarations.

### Cases withheld by the prototype

- Multi-line replacement or insertion hunks:
  no positional one-to-one pairing is invented.
  The Mio invocation withholds 191 lines under this condition.
- Insertion-only or deletion-only changed spans:
  no two-sided correspondence is emitted.
  One further Mio line is withheld for this reason.
- Boundary,
  ignored or foreign-path origins are rejected by the prototype's checks.
  Their fixture catalog is still pending;
  the Mio invocation is not verification of those paths.
- A normalized current-range mismatch is rejected,
  rather than attaching evidence to text it cannot reproduce.

The harness is an acquisition prototype,
not a production feature or complete Git-history parser.

## Verified consumer approach

The probe joins current line origins to ordinary diffs,
uses only unambiguous single-line replacement hunks,
checks the added line against current text,
and derives a minimal contiguous changed span.
Both full lines are reconstructed from prefix,
changed span and suffix as an invariant.
Surrogate-pair boundaries are preserved.

Tradeoffs:
this is conservative and omits revisions that need multi-line reasoning.
A minimal changed span may still be a partial word,
so it is not a semantic diff.
A later whole-line formatting edit may become the reported origin.
No result is evidence that a historical edit was factually correct or officially named.

## What does not work

- Using blame alone as a before/after record.
- Treating every historical replacement as a name choice.
  The actual Mio records include punctuation and fragments such as `dmit` to `ccep`.
- Treating a generic before/after history block as sufficient naming evidence.
  The model probes in
  [the archive evidence design](../planning/translation-repair-archive-evidence-design-2026-09-10.md)
  did not preserve both name retention and genuine-correction controls.

## Upstream filing decision

- Upstream fault:
  no.
  The inspected behavior matches Git's documented output contract.
- Upstream fixability:
  no upstream change is required;
  the consumer must join and interpret the evidence it requests.
- Supported use:
  the documentation explicitly supports line-origin and diff inspection.
- Contribution acceptance:
  not evaluated because no contribution is proposed.
- Expected upstream action:
  no action requested or predicted.
- Compatible prototype:
  the consumer-side read-only harness demonstrates the join;
  no upstream patch is appropriate.

Nothing is proposed for upstream filing.
No issue or comment was drafted or sent.
