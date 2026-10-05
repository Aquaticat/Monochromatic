# Music player template editor: KWGT as precedent

## Purpose

D81 makes supporting text user-configurable through templates in Settings.
Section 11e of `package/music-player/design/open-questions.md` leaves fields,
grammar,
editor controls,
preview,
validation,
fallback behavior,
other row-type coverage and title customization undesigned.
The human named KWGT (Kustom Widget Maker) as precedent on 2026-10-05.
This note lists what KWGT's formula language and formula editor do,
and records which of those features the player keeps and omits.
The human answered that question on 2026-10-05 (D89).
No production implementation is authorized.

## What is already settled

- D81:
  supporting text is templated and configured in Settings;
  title customization is not implied.
- D35:
  the default supporting line uses the neutral `onSurfaceVariant` role;
  its content is not fixed.
- D77:
  accessible-action naming and visible distinction before activation remain required.
- D87:
  the Settings page stays and is empty until the template configuration is designed.

## Sources

### Documentation read on 2026-10-05

- [Music info function `mi`](https://docs.kustom.rocks/docs/reference/functions/mi/)
- [Text converter function `tc`](https://docs.kustom.rocks/docs/reference/functions/tc/)
- [Condition function `if`](https://docs.kustom.rocks/docs/reference/functions/if/)
- [Date format function `df`](https://docs.kustom.rocks/docs/reference/functions/df/)
- [Math operators](https://docs.kustom.rocks/docs/more/math_operators/)

### First-hand run on 2026-10-05

KWGT 3.82 build 621115 (package `org.kustom.widget`),
downloaded from the publisher's own site,
file SHA-256 `481ee09b353028726ce08f59fec3c64d7e80b02e741b125b9c1dbfe3720a0071`.
It ran in a throwaway Android 17 Pixel 9 Pro Fold emulator,
created new for this look and deleted afterwards,
inside a container bounded to 6 GiB of memory and 2 CPUs.
The study emulator and its device image were not used.
A widget was placed on the home screen,
a `Text` item was added,
and its formula editor was opened and typed into.
Screenshots stay in private scratch storage:
the free version shows third-party advertisements,
so none is published.

## What KWGT's formula language does

### Text and formulas

A value is literal text with formulas enclosed in a pair of `$` signs.
Text outside the pair is shown as written.

```text
# typed into KWGT's formula editor
$mi(artist)$ - $tf(mi(len), mm:ss)$
```

With no music playing,
the editor's preview showed `Artist Name - 03:20` for that value.

### Functions

Functions have short two-letter names and take a mode word as their first argument.
`mi(title)`,
`mi(artist)`,
`mi(album)`,
`mi(len)` and `mi(pos)` read the playing track.
Calls nest:
`tf(mi(len), mm:ss)` formats the track length.
`tc` converts text:
lower case,
upper case,
capitalize,
cut to a length,
cut with an ellipsis,
pad,
split,
and regular-expression replace.
`df` formats dates.
Many other functions read weather,
battery,
network,
calendar,
notifications and web content;
those have no counterpart in a local music player.

### Operators and conditions

Inside a formula,
`+` adds numbers or joins text,
and `-`,
`*`,
`/` do arithmetic.
Comparisons are `=`,
`!=`,
`>`,
`>=`,
`<`,
`<=`,
and `~=` matches a regular expression.
`&` and `|` combine conditions.
`if(condition, then, [else])` chooses between values and accepts chained conditions.

### Named values and markup

The documentation lists a global-variable function (`gv`) for reusing a named value across formulas.
The editor's `BB code` example family is described as
`Adds simple text markup like color, bold, italic and so on`.
Neither was exercised in the first-hand run.

## What KWGT's editor does

Seen in the first-hand run.

### Layout

The editor is one screen.
A `Text Preview` line sits on top.
The `Formula Editor` field sits under it.
A row of buttons under the field shows a globe,
a palette,
a star,
and marks for bold,
size,
underline and italic.
None of them was pressed,
so what each does is not an observation here.
An `Examples` area fills the rest,
captioned `(click appends, long replaces)`.
The top bar holds buttons described as `Settings`,
`Star` and `Save` (a check mark).
Whether an edit takes effect before `Save` is pressed was not checked.

### Live preview

The preview changes with every keystroke.
With no music playing it still showed stand-in values:
`Artist Name`,
`Track Title`,
`03:20`.

### Help while typing

While the caret is inside a call,
the function's signature appears above the field with the current argument in bold,
for example `tf(date, [format])`,
and a sentence describing that argument appears under the field.
In one capture the opening `$` and the opening bracket of the outer call were tinted blue;
the rule behind the tint was not explored.

### Errors

A failed formula is reported in a red line under the field,
one line per failure,
naming the function and the problem.
Typing `$xx(1)$ and $mi(nope)$` produced `err: unknown` and
`mi: invalid music parameter: nope`.
The preview then showed only the surrounding literal text,
`and`.
A formula left without its closing `$` raised no error;
the preview showed it as literal text.

### Examples and favourites

Examples are grouped by function family,
such as `Music info`,
`Text converter` and `If conditions`.
Each entry shows a description,
a sample result and the formula,
for example `Current Track Duration (in mm:ss format)`,
`03:20`,
`$tf(mi(len), mm:ss)$`.
A tap appends the formula to the field;
appended formulas are joined with nothing between them.
The caption says a long press replaces the field's content;
that was not tried.
One family is `Fave Formulas`,
described as `Faves formulas, list or delete starred expressions`;
the `Star` button was not pressed.

## Where the player's need differs from KWGT

KWGT edits one free-standing text item.
The player needs,
and KWGT does not show:

- which row types have a template
  (track rows,
  folder rows,
  search results,
  the playing track);
- the player's own fields
  (such as duration,
  true peak,
  folder,
  file name and extension);
- a default per template and a way back to it;
- what a row shows when a field has no value;
- how a template interacts with the visible distinction D77 requires.

Those are design questions for later in this round,
not answered by KWGT.

## Answer: which KWGT features the player keeps and omits

The note first put each KWGT feature to the human with a recommendation.
On 2026-10-05 the human answered:
"I'll go with your recommendations with what to omit and keep."
D89 records it.
Where the recommendation was to keep or to omit,
that is now decided.
Where the note made no recommendation and said the choice was the human's,
the answer decides nothing;
those entries are listed under `Still open`.

### Kept

- Literal text with formulas between a pair of delimiters;
  text outside the pair is shown as written.
- Field functions that take a mode word,
  in the manner of `mi(title)`,
  with the player's own fields.
- Nested calls and formatting functions,
  in the manner of `tf(mi(len), mm:ss)`.
- Text conversion for case and for cutting to a length.
- `if` and comparisons,
  so a row can say what to show when a field has no value.
- A live preview that changes with every keystroke.
- Signature and argument help while the caret is inside a call.
- Error lines that name the function and the problem;
  their wording and marking follow the player's own error design.
- A field list that inserts at the caret.

### Omitted

- Arithmetic,
  unless a use appears.
- Global variables.
- Markup for colour,
  bold,
  italic and the like,
  because D35 gives the supporting line one neutral role.
- Functions for weather,
  battery,
  network,
  calendar,
  notifications and web content.
- Silence about a formula left open;
  the player reports it.
- Saved favourite formulas.
- The button row for markup,
  colour and the globe.

### Still open

The note recommended nothing here,
so the human's answer does not settle these.
They are to be shown as built variants in the editor study,
not asked in words.

- The rest of text conversion:
  ellipsis,
  padding,
  splitting and regular-expression replace.
- Regular-expression match (`~=`) and combining conditions with `&` and `|`.
- What the preview shows:
  stand-in sample values as in KWGT,
  or a real track from the open library.
- Whether ready-made examples are offered beside the field list.
- Whether an edit applies as typed with a way back to the default,
  or only on an explicit save.

## Not decided here

- The field inventory and field names.
- Which row types get templates,
  and whether titles are ever templated.
- Default templates.
- Fallback when a field is empty or a template is invalid.
- The editor's layout on the Fold's inner and cover panels.

The next step is a built Compose study of the editor on the Fold,
shown in a verified review form,
with the entries under `Still open` as variants.
