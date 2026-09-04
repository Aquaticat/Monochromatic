# Defects found in phase one, and the rules that follow from them

Each entry is a real failure in this project's output, with the rule it produced.
They are written out in full because the rules only make sense next to the concrete
thing that went wrong.

---

## 1. Spec numbers were invented from memory, and three were wrong

**What happened.** Components were built to remembered Material Design 3 figures.
Three were wrong: two-line list rows were built at 56dp (the spec is 72dp — 56dp is
the *one*-line height), segmented buttons at 48dp visual height (the spec is 40dp
visual with a 48dp tap target), and slider handles at 4×26px (the updated M3 slider
handle is 4×44px on a 16px track).

**Caught in review** — on the grounds that neither side should be trusting a
memorised spec when the real values are a lookup away.

**The rule.** Read the real values. `m3.material.io` is JavaScript-rendered and cannot
be fetched, but **Google publishes the generated token files** in
`github.com/material-components/material-web` under `tokens/versions/latest/sass/`.
Those are the spec, machine-readable. md3-tokens.md records everything already
extracted and shows how to look up more. If a number is not in there and not read
from the repo, do not write it into a design.

---

## 2. Device dimensions were invented — including inside the question asked about them

**What happened.** Foldable layouts were drawn at 924×600 and 370×760 — numbers with
no source. Worse, the question that finally asked which device was being targeted
offered answer options containing made-up dp figures ("cover ≈390×844dp") — so the
guesswork was baked into the question itself.

**Caught in review**: the stated measurements did not match the rendered layouts.

**The rule.** Get the device model, then derive dp from published px and density.
device-metrics.md has the real numbers for the Pixel 9 Pro Fold and the arithmetic
used to get them. The inner display is **essentially square** — every earlier mockup
used a wide landscape frame and was structurally wrong, not just slightly off.

---

## 3. Candidates were presented without ever being looked at

**What happened.** Several designs went out with wide squashed play buttons —
a 96×60 rounded rectangle where a circle belongs — and later with a transport row
whose prev/next buttons were flung to opposite screen edges.

**Caught in review**, twice — first the fat transport buttons, later a layout that
was simply broken on arrival.

**The rule.** Screenshot every candidate and look at it before it goes in front of the
user. Note that **iframe content is not captured** by the screenshot tooling, so a
contact sheet of candidate files renders blank — check files one at a time.

---

## 4. Bulk find-and-replace was run without re-verifying the result

**What happened.** A batch edit across ~30 files fixed the play buttons by adding
`margin:0 auto` to centre them. In a flex row, `margin:0 auto` consumes all free space
on both sides — which pushed the neighbouring buttons to the container edges and broke
every single-column layout. It shipped.

**The rule.** After any bulk edit, open at least one file per affected layout family
and look at it. Batch edits are fine; batch edits with no verification are not.

---

## 5. The 1,000-folder scale rule was forgotten repeatedly

**What happened.** Folder-picker and fold layouts were repeatedly demonstrated with a
dozen folders, when the real library has ~1,000. It had to be raised in review more
than once, and cost two rejected candidates.

**The rule.** Every folder surface is shown at ~1,000 entries, using
candidates/artists.js. The interesting design problems (jump strip, letter targets,
wrapping, counts) only exist at that scale.

---

## 5b. The 1,000-folder rule was misread as "show 1,000 rows" — three times

**What happened.** unf-b, unf-c, unf-d and unf-e all rendered every folder as its own
48dp row and then bolted an index onto the side. The user, third time: "One sub-dir
per row would make the scrolling area absurdly large. We should be prepared to handle
1k sub-dirs." Decision D3 already said it — "wrapped 48dp targets, not a single narrow
column" — and picker-f already demonstrated it. Neither was read closely enough.

**The rule.** The 1k rule means the picker must **cope** with 1,000 folders, not
**list** them. A folder surface never shows more than about one screen of names:
filter to a letter (and to a 2-letter bucket when a letter has more than ~24 names),
then lay the names out as wrapped, content-width chips. Scrolling a thousand rows is
the failure, not the demonstration. unf-f is the first candidate to get this right.

## 5e. Question forms went out with no free-text field

**What happened.** The standing rule above was already written down, in softer words
("every question offers a way out"), and two forms in session 3 went out as pure
option pickers anyway — the picker-verdict form and the round-two follow-up. The user:
"I also said a standing rule is to always include free text input for me to fill out
for any option in a prev session, but clearly that didn't make it to the docs as
well." Both times the user had to type the real answer into chat instead, and both
times that answer was the one that mattered: the chips objection was about styling,
not layout; rows were dead regardless of column count.

**The rule.** A form without a free-text field is an unfinished form. Write the
free-text question first, before the options, so it cannot be forgotten at the end.
Where a form is a follow-up round, add a `user-questions` item too.

## 5d. Rejected patterns came back because the notes recorded the objection loosely

**What happened.** Two of the user's rejections were written down in these documents in
a narrower form than they were meant:

* "we don't really need this as tabs" (about the CA / CH / CL–CO split) was recorded in
  D17 as *no sub-buckets as tabs*. The segmentation itself was what died. It came back
  as a rail accordion in pk-d.
* "picker names not as a wall of chips" was recorded as presentation being "open" — and
  then written into D28 as *chips are still the presentation*.
* One name per 48dp row had been rejected for the long scroll (5b) and was rebuilt
  three more times (pk-a, pk-b, pk-c), then twice again in different column counts
  (pk-e, pk-f), each time as though the count of columns were the objection.

The user, on the fourth: "Rows again? That's also killed, at least 4 times today."

**The rules.**
1. **Record a rejection as a NO, not as a nuance.** Write the general form of what died
   ("no sub-letter segmentation, in any form"), then the quote, then the specific
   candidate. If the general form is not obvious, ask which it is before writing it.
2. **Keep the NO list next to the decision** — D17 now carries all three picker NOs.
3. **Check a new candidate against the NO list before showing it.** Every rejected pk-*
   candidate would have failed that check in one line.
4. **A rejection can be about the styling and not the layout** (chips), or about the
   layout and not the styling (rows). Ask which, rather than assuming the whole
   treatment died.

## 5c. Device layouts were judged in a stretched preview

**What happened.** The file-options preview stretched a 411×923 layout to fill a large
window. The user saw a distorted render and reasonably asked whether it had been
checked. **The rule.** Every device candidate renders inside a fixed device-size frame
that scales to fit (see unf-f, cover-c, desc-d for the pattern).

## 6. Questions were asked that the design had already answered

**What happened.** A whole round was spent asking what should happen after the last
track in a folder — but the mode control (Repeat / In order / Shuffle folder /
Shuffle all) already answers it. The round produced two candidates that were moot
before they were built.

**The rule.** Before asking, check whether an existing decision determines the answer.
Every question must change what gets built next.

---

## 7. Questions were asked in words when only a demo could answer them

**What happened.** Several rounds of prose questions about things that can only be
judged by looking: which design generation, which row density, how the list behaves
when playback moves. Each round had to be redone as built demos.

**The rule.** If the question is about appearance or behaviour, build 2–3 real
candidates first and ask by showing them.

---

## 8. A layout bug that will recur if you do not know about it

`height:100%` on the root of a Design Component resolves against nothing, so
fixed-proportion layouts collapse to zero and overlap. Every candidate in this project
had this bug at one point. Use `height:100vh` plus flex with `min-height:0` on
scrolling children.

---

## 5g. A light-theme study was shown on a dark desk, and never looked at

**What happened.** The light-theme candidates were correct inside the device frame, but
every frame sat on a #4A4458 purple desk with a near-black caption bar, and the frames
only filled the top third of a tall preview — so two thirds of the screen was dark and
the study read as "not a light theme" at a glance. The user, having already asked five
times for output to be checked: "The light theme isn't light theme. Did you even check
your own output as I told you the 5th time?"

**Second and third failure, same question.** The corrected files were shown in a
question form, and all three light candidates rendered DARK in their thumbnails. Two
separate causes, and the first fix did not address the real one:

* the token sheets were linked `../_ds/…`, which does not resolve in every context
  that renders a candidate; and
* **the real cause** — the design system publishes its dark scheme under
  `[data-theme="dark"]`, the HOST sets that attribute on `<html>` when the user's app
  is in dark mode, and custom properties inherit. So a "light" study built on
  `var(--md-sys-color-surface)` renders in the DARK scheme on a dark-mode host, while
  looking perfectly light in a light-mode preview. Baseline fallbacks did not help:
  the variables were defined, just defined dark.

The fix that holds: **declare the scheme inline on the study's own root element**
(`style="--md-sys-color-surface:#FEF7FF;…"`), where nothing upstream can override it,
and give `html`/`body` the literal desk colour since they sit above that root.

**The rules.**
0. **A design-system reference must resolve from wherever the file is rendered, and
   must not inherit the host's scheme.** Copy the token sheets next to the candidates
   and link them without `../` traversal; pin the intended scheme's roles inline on the
   design's own root element; keep baseline fallbacks in every `var()`. Then verify by
   forcing the opposite scheme on `<html>` (`data-theme="dark"`) and screenshotting —
   a light study must stay light. Neither a missing stylesheet nor a dark-mode host may
   be able to invert a theme.
1. **A theme study is presented on that theme's own desk.** Light candidates get a
   light desk, a light caption bar and light badge text; dark candidates get a dark
   one. The surround is part of what the user judges — it is never left at whatever the
   previous candidate used.
2. **Frames fill the viewport.** A fixed design height scaled to fit leaves dead desk
   below it, which dominates the impression. Let the frame take the available height.
3. **Look at the rendered output before asking about it** — and when the question is
   "does this read as X", look at it in the USER's view, at their window size, not only
   in a preview iframe of a different shape.

## 5f. Rules were written down in a form too soft to be followed

**What happened.** Three of the user's rules were recorded as hedged prose, and each
was then broken by someone reading those exact words:

* "every question offers a way out" — read as a preference; two forms went out with no
  free-text field at all (5e).
* "no sub-buckets *as tabs*" — read as banning one presentation; the segmentation came
  back as a rail accordion (5d).
* "picker names not as a wall of chips" was filed under presentation being *open* —
  and then written back into a decision as chips (5d).

The user: "Record that never to record rules as 'soft' again."

**The rule — how a rule gets written here.**
1. **Imperative, absolute, no hedging.** "Every form ends with a free-text field. No
   exceptions." Never "usually", "generally", "prefer to", "where it helps", "consider",
   "as a rule of thumb", or "when the options feel thin".
2. **Write the general form, then the quote, then the instance.** The general form is
   the rule; the quote is the evidence; the candidate name is only an example. A rule
   recorded as its instance shrinks to that instance.
3. **State the scope explicitly when it is narrower than the words** — "this is about
   the styling, not the layout" — rather than leaving the reader to guess which half
   died. If the scope is not known, ask before writing it down.
4. **No rule lives only in prose.** It goes in the numbered standing standards below or
   in a lettered decision, where it can be cited and checked against.
5. **Anything the user calls a rule, a constraint or a standing instruction is
   absolute** unless they later relax it — and a relaxation is recorded the same way.

## 5h. The cost of this session, measured

Nine question forms went out in one session; five had to be re-asked, none because the
user changed their mind:

| # | What was asked | Why it was wasted |
|---|---|---|
| 1 | pk-a/b/c picker presentations | rebuilt a pattern rejected 3× already (rows) — 5d |
| 2 | pk-e/pk-f | rows again, in different column counts — 5d |
| 3 | light/dark/dbtp studies | one file per question, so no actual choice to make |
| 4 | same, split into files | light studies rendered dark on the user's host — 5g |
| 5 | same, with my picks | pros and cons were in chat, not where the user was looking — 5e/6 |

Three of the five were failures of **checking**, not of design: the candidate was never
compared against the recorded NOs, or never looked at in the user's own view before the
question went out. The user, mid-session: "Did you even check your own output as I told
you the 5th time?" and, at the end: "I think we both might not be feeling well today,
given how many mistakes we made."

**The rule.** Before a form goes out, three checks, every time:
1. Does each candidate violate anything on the NO list for that surface? (D17-style
   NOs, kept next to the decision.)
2. Has each candidate been rendered and looked at — in the user's view, at their
   window size, in their colour scheme?
3. Does each option carry pros, cons and my pick, in list form, in all three places
   the user might read them?

## 5i. A visual decision round was delivered as chat text

**What happened.** Session 5 resumed from the archive and correctly found the two
built theme choices, but presented their options, assessments and recommendations as
a long chat prompt. The user: "Ask me properly via a self-contained HTML rendering
you then open in Helium."

**The rule.** Every design-question round is one self-contained HTML form opened in
Helium. Embed every visual candidate, option assessment, ranked recommendation and
answer control in the file. End with free text. Require no external stylesheet,
script, font or server. Render, inspect and exercise the form before opening it. Every
device mock must zoom to its cited target dimensions and expose its current scale plus
a reset control. Chat may report that the round is ready; it never substitutes for the
form.

**Handover timing.** The user then instructed: "Update the handover as you go."
Record every correction, answer, decision, candidate and verification result in
HANDOFF.md when it happens. Never wait until the session ends.

## Standing standards for this project

1. **EVERY question form ends with a free-text field. No exceptions.** Not "usually",
   not "when the options feel thin" — every form, every round. Options are always a
   partial guess at the problem space, and this project's best decisions arrived as
   free text rather than as one of the offered choices: tabletop-c, the true-black
   requirement, the argument against a bespoke design system, the Todoist-style undo
   toast, the first-run "Scan once / Always scan / Dismiss once / Dismiss forever"
   prompt, and the correction that chips were a styling objection and not a layout
   one. Two forms in session 3 shipped without one (see 5e) and both cost a round.
   The field is labelled openly — "anything else you want settled or changed" — and
   sits last. A `user-questions` item, letting the user raise what the questions
   missed, belongs on any follow-up round.
2. **Visual and behavioural questions are asked by building**, not by describing.
3. **Design calls belong to the designer.** Bring a recommendation with reasoning;
   ask only what the owner alone can answer — their library, hardware and habits.
4. **Known defects are stated up front**, in the same breath as the work.
5. **Project state lives in Markdown.** These documents exist so a session starting
   from nothing can pick the work up without losing decisions. Keep them current as
   decisions land.
6. **Every option is presented with my own assessment: pros, cons, and a pick —
   written as a LIST.** The user asks for choices, not a menu read out flatly —
   "you're supposed to comment on each option with what you think yourself of the pros
   and cons of that option" — and wants it structured: "I would like pros and cons in
   list form." So, per candidate:
   ```
   PROS   · one point per line
          · one point per line
   CONS   · one point per line
   MY READ · pick / fallback / reject, and why in one line
   ```
   Never a prose paragraph, never a run-on sentence with semicolons. This applies in
   three places at once, because the user may be looking at any of them: the chat
   message, the form's question subtitle, and the caption printed inside the candidate
   file itself. A neutral list of equally-weighted options is an unfinished
   presentation; recommending one does not pre-empt the decision, and withholding the
   judgement wastes a round.
7. **True black (#000) is a standing rule, not a preference.** The dark scheme's
   background is pure black and stays pure black. It survives the bound MD3 design
   system, whose own dark surface role is neutral6 (#141218) with a five-step container
   ramp above it — where MD3 and true black disagree, **the surface roles get
   overridden, not the rule** (decisions.md B1). Never re-ask this, and never quietly
   let a token file reintroduce #141218.
8. **Rules are recorded absolutely, never softly** (see 5f). Imperative wording, the
   general form first, the scope stated, no hedge words. Every rule in this file and
   in decisions.md is to be read as binding, not advisory.
9. **Every design-question round is one self-contained HTML form opened in Helium.**
   Embed the built visual options, pros, cons, ranked recommendation, answer controls
   and final free-text field. Require no external stylesheet, script, font or server.
   Render, inspect and exercise it before opening it. Every device mock must zoom to
   its cited target dimensions and show its current scale plus a reset control.
   Chat-only delivery is invalid.
10. **Update HANDOFF.md continuously.** Record each correction, answer, decision,
    candidate and verification result when it happens. Never defer updates until the
    end of a session. 
