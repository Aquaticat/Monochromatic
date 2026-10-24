# TypeScript 7.1.0-beta answers `textDocument/inlayHint` with hints that stand outside the requested range

`tsc --lsp --stdio` from `typescript@7.1.0-beta` answers a range request with the hints of every syntax node that
reaches into the range,
and a node's hints stand where the node puts them,
not where the range is.
A statement that begins above the range and has a body that runs through it answers with the hints of its first line,
although that line is not in the range.

The IDE (`package/desktop-app/ide`) asks for the lines around the view and keeps hints per line
(`Annotations::merge_labels` in `src/annotation/blocks.rs`).
Before the fix recorded here it treated every hint of an answer as part of that answer,
so each answer for lines past a long statement added that statement's hints to its first line again.

## Symptom

Opening `package/build-tool/css/src/build.unit.test.ts` (286 lines) and clicking around the minimap:

- The block of virtual rows above line 96 (`const integrationChildren = integrationFixtures.map(...)`)
  held the same four hints twice,
  three times,
  and up to five times,
  so every line below it moved down by one more block each time.
- The minimap's picture,
  which is drawn from the same blocks,
  showed the repeated rows as a band of overdrawn text,
  and the box and the picture jumped as the repeated rows came and went.
- The repeated rows went away for the lines an answer asked about,
  so after clicking back to line 96 the hints were doubled until the next answer covered it.

With the window's own log (`RUST_LOG=ide_app=debug`),
the count of hints on line 96 after each answer,
measured before the fix with a probe line in `merge_labels`,
was:

```text
first=0   last=154  answered=41  line96=4
first=137 last=287  answered=68  line96=8
first=70  last=287  answered=86  line96=4
first=146 last=287  answered=62  line96=8
```

An answer that asks for line 96 replaces its hints (4);
an answer that does not ask for it adds 4 more.
Answers that follow one another without a covering answer between them add 4 each.

## Probe

The server was started on the project's own TypeScript
(`node node_modules/typescript/bin/tsc --lsp --stdio` in `package/build-tool/css`),
initialized with the `typescript.inlayHints` settings of `src/language/config/typescript.rs`,
and asked for hints over line ranges of the file
(zero-based,
end exclusive,
as `Annotations` is told them).
Hints on lines outside each range:

```text
range [0, 95)    asked: 21 hints,  0 outside
range [0, 100)   asked: 27 hints,  0 outside
range [100, 200) asked: 64 hints,  4 outside: 96:25 `: TestDescriptor<DescribeResult>[]`, 96:52 `callbackfn:`,
                                              96:68 `: { readonly label: ... }`, 96:70 `: TestDescriptor<DescribeResult>`
range [150, 250) asked: 61 hints,  8 outside: the four of line 96, `opts:` of line 117, `opts:` of line 145,
                                              `: Promise<void>` of line 147, `options:` of line 149
range [200, 286) asked: 32 hints,  4 outside: lines 181, 184, 189, 191
range [95, 96)   asked:  4 hints,  0 outside
```

A request that covers line 96 returns its four hints once.
A request that starts after line 96 and before the end of the statement returns them too.

## Cause

A range request returns the hints of the nodes that intersect the range.
It does not drop a hint whose own position is outside it.
That is allowed by the protocol (`InlayHintParams.range` is the visible document range,
and the result is not required to be limited to it),
so the client has to do the limiting.

## Fix

`merge_labels` keeps only the hints of a snapshot that stand on the lines the snapshot asked about
(`first_line` to `last_line`),
which are the lines whose old hints it removes.
A line the answer did not ask about keeps what the answer that asked about it gave,
and a debug record names how many hints were left out.

The tests are `hints_outside_the_asked_lines_are_not_part_of_an_answer` in `tests/annotation.rs` and
`an_answer_for_other_lines_adds_no_hint_to_a_line_it_did_not_ask_about` in
`src/native/annotation_range_tests.rs`,
and the guards `hints-asked-lines` and `hints-asked-lines-window` in `bin/inspect-source-guards.ts`
remove the rule in a disposable copy and watch those tests fail.

A hint of an unasked line is not lost:
the next answer that asks for that line returns it,
and the store takes it then.
