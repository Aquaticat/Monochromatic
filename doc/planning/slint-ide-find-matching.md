# Slint IDE in-file find matching

## Scope

In-file find is already part of the accepted read-only IDE scope.
The reference is editord's browser-provided Ctrl+F behavior,
not another regular-expression search surface.
Browser matching semantics are adopted under that existing instruction;
no new matching dependency has been selected or adopted.

The native implementation must keep original source positions and copy bytes,
reject stale results after file navigation or external reload,
and perform no project mutation.
Any deliberate mismatch needs a named conformance case and explanation.

## Measured reference

`inspect:find-reference` uses a disposable browser profile,
synthetic source strings,
positive and negative controls,
and closes its session in `finally`.
It does not inspect or change the host clipboard.
The profile's `Last Version` identifies Chrome `149.0.7827.54`.

The first capture is `/tmp/ide-find-reference-is2TFy/results.json`.
The extended capture is `/tmp/ide-find-reference-mskkxd/results.json`.
The latter is preserved in
`package/desktop-app/ide/tests/fixture/browser-find.json`.

Observed matches include case differences,
canonical accent equivalents,
plain letters against accented text,
`STRASSE` against `Straße`,
`office` against `oﬃce`,
final sigma,
dotted I,
NBSP against space,
curly against straight quotes,
and a word containing a soft hyphen against the unhyphenated query.
A partial `s` query does not match `ß`.
Empty patterns,
soft-hyphen-only patterns,
and combining-mark-only patterns do not match the tested inputs.

The kana cases are intentionally specific:
`カ` matches `か` and `ｶ`;
`や` does not match `ゃ`;
`か` does not match `が`;
composed `が` matches decomposed `か` plus a combining voicing mark;
`ガ` does not match the tested halfwidth voiced form `ｶﾞ`.

The fixture is one preformatted text element.
Literal newline queries match literal newlines in that fixture,
while an ordinary space query does not replace a newline or tab.
This does not yet establish multiline behavior in editord's actual one-div-per-line DOM.

## Pinned source trace

Source snapshots are under
`~/temp/agent/ide-find-chromium.s8LhH4ir`,
using Chromium tag `149.0.7827.54`.
The source fetch initially failed only for `third_party/icu/README.chromium`;
ICU is a separate checkout,
so the remaining fetch records Chromium's `DEPS` instead.

- `third_party/blink/renderer/core/frame/local_dom_window.cc:1543` implements `Window.find`.
  It sets case-insensitive behavior from the inverse of the supplied case-sensitive flag
  and calls `Editor::FindString`.
- `third_party/blink/renderer/core/editing/editor.cc:850` forwards to `FindRangeOfString`.
  `FindStringBetweenPositions` invokes `FindBuffer::FindMatchInRange`.
- `third_party/blink/renderer/core/editing/finder/text_finder.cc:244` also invokes `Editor::FindRangeOfString`
  for the find-in-page UI,
  with differences in navigation and ruby flags.
- `third_party/blink/renderer/core/editing/finder/find_buffer.cc:406` folds quotes and soft hyphens
  before constructing `FindResults`.
- `third_party/blink/renderer/core/editing/finder/find_results.cc:13` supplies the pattern and UTF-16 text
  to `TextSearcherICU`.
- `third_party/blink/renderer/core/editing/iterators/text_searcher_icu.cc:45` creates ICU StringSearch
  with the UI language plus `@collation=search`.
  Its `SetCaseSensitivity` at line 247 selects primary collation strength for case-insensitive matching.
  It filters zero-length matches and applies an additional NFC-based kana check.
- `third_party/blink/renderer/platform/text/unicode_utilities.cc` implements the quote,
  soft-hyphen,
  and kana handling.

These paths connect the probe and UI to the same matching engine.
They do not establish identical navigation,
shadow-tree,
ruby,
or DOM block-boundary behavior.

## Next verification

- Run `inspect:find-regex` to measure the existing Helix regex engine against the captured corpus.
  It escapes all query punctuation and enables Unicode case-insensitive matching;
  it does not assume that this equals collation search.
- Probe editord's one-div-per-line structure before treating multiline queries as accepted native behavior.
- Freeze candidate discovery and run the technology-vetting workflow before recommending another matching dependency.
- Keep UI and worker design independent of any unadopted matcher choice.
