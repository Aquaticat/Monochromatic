# Module-test explainer: teaching-interface revision

## Current request

The reader rejected the teaching UI/UX after the addition of code demonstrations.
They authorized a fix if the cause could be identified;
otherwise they wanted an honest question informed by specific suspicions.
Earlier requirements remain:
dark theme,
one self-contained `*.local.html`,
visual and interactive explanation,
no assumed prerequisites,
and depth rather than a shortened substitute for teaching.

## Diagnosis and evidence

The previous version separated program selection,
concept selection,
code scrolling,
and output revelation into independent controls.
This is an interaction-design diagnosis,
not a claim about the reader's patience or cognitive ability.

Helium reported a 1012 × 676 CSS-pixel viewport with device-pixel ratio 2.
The old page was measured at that viewport in the isolated test browser:

- Chapter 02 exposed 29 controls in its rendered content.
- The code pane was 608 CSS pixels high with 1084 pixels of scrollable content.
- The explanation occupied a separate column.
- Output controls began at document position 2686.4375,
  below the code pane beginning at 2029.6875.
- The observer chapter was 5876.890625 CSS pixels high.

The layout made following an explanation and checking its consequence require
navigation between independently changing regions.
Revealing `[stdout]` as the first output step added an action without teaching a mechanism.
Passing accessibility checks did not establish teaching usability.

## Implemented revision

Replaced the workshop dashboard with one guided sequence.
Each lesson connects one question,
focused code,
an explanation,
and its consequence.
Back/next navigation follows conceptual dependencies.
Meaningful comparisons change the code and consequence together.
There is no independently scrolling code pane in the teaching surface.

Preserve all six verified standalone Node programs and their recorded results.
Full-source inspection is explicit and secondary,
not required to operate the lesson.
Preserve the shared observer's actual listener mechanism,
attribution limits,
failure-status contract,
reporting safeguards,
and the historical exported-build verification gap.
Do not change package runtime code or treat historical results as current verification.

## Guidance gap

Proposed addition beside the prior teaching-depth proposal:

> Keep the mechanism,
> explanation,
> and consequence together.
> Interaction must expose a causal difference;
> do not make readers coordinate independent controls to follow one lesson.

No `AGENTS.md` amendment is being silently ratified.

## Built revision

The replacement now has eleven ordered lessons with previous/next navigation
and a separate guide for direct access.
The three in-lesson comparisons connect source and consequence:
await versus void,
first versus later runtime acquisition,
and context-based attribution versus the executed current-variable control.
Numbered annotations match markers on the relevant source lines.
There is no independent output-reveal state.
Full programs and captured output use an explicit inspection dialog.

The previous local artifact is preserved as
`doc/troubleshooting/module-test-explainer-before-ux.local.html`.
It is evidence,
not a second candidate being presented to the reader.
All six embedded standalone sources and their captures are preserved unchanged.
The attribution-control download reconstructs the exact already-executed variant.

## Verification

The actual visible Helium window reported 1012 × 676 CSS pixels at scale factor 2.
In the delivered observer lesson,
the code panel ended at viewport y=524.078125,
the recorded result ended at y=571.375,
and navigation began at y=611.
The code,
explanation,
and consequence therefore fit together above navigation in that measured view.

The isolated browser checks covered all eleven lessons,
both states of all three comparisons,
guide jumps,
previous/next navigation,
heading focus,
and seven full-source inspection cases including the attribution control.
Every lesson was checked for horizontal overflow and nested vertical scrolling;
neither was present at the measured desktop viewport.
The observer view was also inspected at 390 × 844,
where it uses one normal document-scrolling reading order without horizontal overflow.

The six original Node program sources and the capture JSON were compared byte for byte
against the preserved pre-redesign artifact and were identical.
The generated attribution-control program was downloaded through the actual browser link,
compared against the exact previously executed source transformation,
and executed under Node v26.8.1 with explicit throw policy and NODE_OPTIONS cleared.
It reproduced the recorded B attribution,
all other stdout,
empty stderr,
and exit 1.

The eleven accessibility audits identified one heading-order issue in the attribution lesson.
Changing its annotation headings from h3 to h2 removed that violation on recheck.
Other remaining audit incompletes concerned non-text arrow symbols;
manual computed-color checks measured contrast ratios of 8.705257560303803
for the awaited/detached arrows and 14.04023276034466 for the shared-runtime arrow.
The source-omission marker was made explicit text instead of a bare symbol.
The full-source modal passed its audit without violations or incomplete checks.
Actual browser clicks plus Escape verified focus restoration to the guide trigger
and to the full-source trigger.

No package runtime code,
build output,
or GitHub issue was changed for this teaching-interface revision.
The displayed delivery-path comparison remains explicitly historical.

The final observer lesson was opened at the `#observer` fragment in Helium.
The window check reported one matching window,
active and not minimized,
on output DP-2.
The isolated test browser was closed;
the visible lesson was left open.
