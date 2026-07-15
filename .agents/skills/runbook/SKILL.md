---
name: runbook
description: Use when writing manual steps a user must execute (clicks, keys) after bridges failed.
---

# Writing a runbook

Fires only after bridging paths have been tried and confirmed not to work.
Never the first move.
Walk this skill end-to-end whenever the task involves writing instructions for a user
to execute UI clicks,
 key presses,
 file edits,
or any other manual action that automation could not perform.

Other surface phrases that should trigger the skill:
"you'll need to",
 "please open",
 "manually click",
"write a runbook",
 "verification script",
 "steps for the user",
"what should I tell the user to do".
The earliest cue is the moment you catch yourself about to write
"you'll need to" or "please open" in chat.
If you have reached that moment without naming the bridges you tried,
stop,
 try the bridges,
 then come back.

The skill encodes five pieces:
required sections (Setup,
 Steps,
 What to check,
 Restore),
element-level rules (bold UI elements,
 expected outcomes,
 exact strings),
fresh-context completeness,
the canonical example,
and the cues that signal you are violating the rules.

Recorded dances (verified multi-step procedures kept beside this skill):

- `copilot-review-draft-pr.md`:
   getting a Copilot code review onto a PR that
  must stay draft (Copilot skips drafts;
   the ready window can be seconds).

## Bridges to try before writing a runbook

This skill is the fallback.
Before reaching it,
 try at least one of:

- `agent-browser` for web UIs;
  most clicks have a backing HTTP/IPC endpoint or keyboard shortcut.
- `xdotool`,
   `wtype`,
   or `ydotool` for native UI clicks.
- `expect` for interactive auth flows.
- A CLI flag or API token for actions the UI exposes.
- A keyboard shortcut to synthesise the click
  (most menu items have one;
   check the UI before drafting steps).

State the bridges you tried in the runbook's prelude
so the user can tell an unconsidered handoff from a real obstacle.

See AGENTS.
md "Before claiming inability" and "Handing off manual actions" lead paragraph
for the broader rule:
 a capability claim about the whole toolset,
not about any single tool.

## Fresh-context completeness

Every runbook must work for a fresh machine,
fresh person,
fresh checkout,
fresh credentials context,
and no ambient memory from the agent session that produced it.
Assume the reader has only the runbook and access they can legitimately obtain.

Encode every prerequisite directly in the runbook:

- Required OS,
  app,
  CLI,
  browser,
  package manager,
  device,
  account,
  repository,
  branch,
  token,
  permission,
  or network condition.
- Exact paths,
  commands,
  URLs,
  identifiers,
  screen names,
  and expected starting state.
- How to install,
  sign in,
  fetch,
  clone,
  build,
  start,
  or navigate to the state the steps require.
- How to recover if a prerequisite is already present,
  absent,
  expired,
  or named differently on a clean system.

Do not rely on chat history,
local shell history,
previously opened tabs,
existing build artifacts,
already-authenticated CLIs,
machine-specific paths,
or the current user knowing why the procedure matters.
If the runbook omits context because "the user already knows",
it fails.

## Required sections

Every runbook has these four sections in this order.
Status markers per section let the user interrupt and resume.

```md
### Setup

Status:
TODO | DONE

What to bring up first.
Open the app, sign in, navigate to the screen that the steps assume.

### Steps

Status:
TODO | DONE

1. Numbered actions, one observable action per step.
2. Bold every UI element.
3. State the expected outcome after every state-changing step.

### What to check

Status:
TODO | DONE

Expected outcome with the exact strings to grep or filter for.
Use concrete strings, not paraphrases.

### Restore

Status:
TODO | DONE

How to undo any test state, return the system to its pre-runbook configuration,
or delete created resources.
```

The `Status:` marker per section,
with `TODO | DONE` on the line below it,
lets the user cross out `TODO`
and leave `DONE` to signal section completion.
The value sits on its own line because the repo's semantic-line-breaks lint requires a break after the colon;
keep it split rather than rejoining it onto the `Status:` line.
Multi-section runbooks survive interruption this way.

## Element-level rules

### Numbered steps, one action per step

Each numbered step does exactly one observable thing.
If a step bundles "open the menu and click Settings and then click Save",
split into three steps.
The reader scans by number;
 bundling defeats the scan.

### Bold every UI element

Every keystroke,
 menu label,
 button label,
 and tab name gets `**bold**`:

- Keystroke:
   `**F12**`,
   `**Ctrl+L**`,
   `**Shift+F6**`.
- Menu or button label:
   `**Console**`,
   `**Delete**`,
   `**New File**`.
- Tab name:
   `**Network**`,
   `**Application**`.

Name both the key and the menu when both exist.
Write `Open Chrome DevTools (**F12**)`,
 not just `open DevTools`.
The bold visually anchors the eye to the exact thing to press or click.

### Expected outcome after every state-changing step

After every step that changes state (click,
 key,
 type),
state what the user should see:

- A logged line in the console.
- A refreshed pane.
- A closed dialog.
- A field gaining focus.

No implied feedback.
If the action has no visible feedback,
that itself is the expected outcome
("no error appears in the console").

### Concrete strings, not paraphrases

Use the exact string the user should see or filter for.
Paraphrasing forces the user to re-derive the exact string
when their eyes scan the output.

- Filter for `"type":"fileChanged"`,
   not "the rename event".
- Expect `editord listening on port 4400`,
   not "the daemon should start".
- Expect `{ "zeroSize": 0, "zeroMatch": 0 }`,
   not "the size check passes".

## Pull-request-opening steps

Any runbook step (or direct action) that opens a PR follows this lifecycle:

1. Open the PR as a draft (`gh pr create --draft ...`).
   Never open ready-for-review directly.
2. Wait a few minutes for auto reviewers (e.g. Copilot) to post their comments.
3. Address every reviewer comment:
   fix what is right (follow-up commits,
    no amend or force-push),
   reply with verified reasoning where a change is not warranted,
   and resolve each thread.
4. Only then convert the PR to ready for review (`gh pr ready <number>`).

A runbook whose Steps section opens PRs must encode all four stages,
including the expected outcome of the draft state
(`gh pr view <number> --json isDraft` prints `{"isDraft":true}`)
and the final conversion.

## File placement

A runbook (manual-step procedure) that spans the whole repo lives in `doc/runbook/<topic>.md`,
kebab-case,
 with no prefix (the directory names the family).
 A cross-session state handover lives in
`doc/handover/<topic>.md`.
 A runbook or handover tied to one package stays beside that package's code
and keeps the `HANDOVER.<topic>.md` form,
 where the prefix still namespaces it among source files.

## Canonical example

`package/desktop-daemon/editord/HANDOVER.chokidar-atomic-migration.md` is the reference runbook.
Match its shape:
 status markers per section,
what-this-proves intent at the top,
numbered steps with bold UI elements,
what-to-check with exact filter strings,
restore section.

The reference's section headers,
 copied verbatim
so the skill is self-contained if the example file moves:

```md
## What this proves

## Setup

Status:
TODO

## Steps

Status:
TODO

## What to check

Status:
TODO

## Restore

Status:
TODO
```

## Cues you are violating the rules

- "you'll need to" or "please open" without naming the bridges you tried.
- "open DevTools" instead of "Open DevTools (**F12**)".
- "find the menu" instead of "right-click an entry,
   pick **New File**".
- A step without an expected outcome.
- A paraphrase ("look for the rename event")
  instead of an exact filter string (`"type":"fileChanged"`).
- A prerequisite hidden in chat history,
  shell history,
  existing machine state,
  or current-user memory.

Each cue is a one-grep self-check after writing the runbook.
Scan once before handing it to the user.

## Quality check before handing the runbook off

- At least one bridge tried and named in the prelude.
- Fresh-context completeness satisfied:
  a new person on a new machine can reach the required starting state from the runbook alone.
- All four sections present (Setup,
   Steps,
   What to check,
   Restore)
  with `Status: TODO | DONE` markers.
- Every UI element bold.
- Every state-changing step has an expected outcome.
- Every filter or expected string is concrete
  (the exact bytes the user will see).

If any item is unmet,
 do not hand the runbook off.
